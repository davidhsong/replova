import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import type { Plan } from '@/lib/planLimits'

async function getRestaurantContext(): Promise<{ restaurantId: string; ownerEmail: string } | null> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = getSupabaseAdmin()

  // Prefer the active location cookie for multi-location users
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, owner_email')
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .single()
    if (restaurant) return { restaurantId: restaurant.id, ownerEmail: restaurant.owner_email }
  }

  // Fall back to first restaurant by owner_email
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .eq('owner_email', user.email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return restaurant ? { restaurantId: restaurant.id, ownerEmail: restaurant.owner_email } : null
}

export async function GET() {
  const ctx = await getRestaurantContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  const [settingsResult, restaurantResult] = await Promise.all([
    admin
      .from('restaurant_settings')
      .select('*')
      .eq('restaurant_id', ctx.restaurantId)
      .single(),
    admin
      .from('restaurants')
      .select('report_logo_url')
      .eq('id', ctx.restaurantId)
      .single(),
  ])

  const { data: settingsData, error } = settingsResult
  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ...(settingsData ?? { restaurant_id: ctx.restaurantId }),
    report_logo_url: restaurantResult.data?.report_logo_url ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getRestaurantContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const admin = getSupabaseAdmin()

  // Look up plan for gated fields
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', ctx.ownerEmail)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'

  // Gate: persona requires Agency plan
  if ('reply_persona' in body && plan !== 'agency') {
    return NextResponse.json(
      { error: 'Custom reply persona requires Agency plan.' },
      { status: 403 }
    )
  }

  // Gate: report_logo_url requires Agency plan — update restaurants table separately
  if ('report_logo_url' in body) {
    if (plan !== 'agency') {
      return NextResponse.json(
        { error: 'Report branding requires Agency plan.' },
        { status: 403 }
      )
    }
    await admin
      .from('restaurants')
      .update({ report_logo_url: body.report_logo_url })
      .eq('id', ctx.restaurantId)
    // If only updating logo, return early
    const otherKeys = Object.keys(body).filter(k => k !== 'report_logo_url')
    if (otherKeys.length === 0) return NextResponse.json({ success: true })
  }

  const allowed = ['auto_reply_enabled', 'auto_reply_delay_hours', 'reply_persona', 'notify_negative_reviews', 'negative_threshold']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await admin
      .from('restaurant_settings')
      .upsert({ restaurant_id: ctx.restaurantId, ...patch }, { onConflict: 'restaurant_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
