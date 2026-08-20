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
      .eq('active', true)
      .single()
    if (restaurant) return { restaurantId: restaurant.id, ownerEmail: restaurant.owner_email }
  }

  // Fall back to first restaurant by owner_email
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .eq('owner_email', user.email)
    .eq('active', true)
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
      .select('report_logo_url, cuisine_type')
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
    cuisine_type: restaurantResult.data?.cuisine_type ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const ctx = await getRestaurantContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const acceptedKeys = new Set([
    'auto_reply_enabled', 'auto_reply_delay_hours', 'reply_persona',
    'notify_negative_reviews', 'negative_threshold', 'cuisine_type', 'report_logo_url',
  ])
  if (Object.keys(body).some(key => !acceptedKeys.has(key))) {
    return NextResponse.json({ error: 'Request contains unsupported settings' }, { status: 400 })
  }
  const admin = getSupabaseAdmin()

  // Look up plan for gated fields
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', ctx.ownerEmail)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'

  if ('auto_reply_enabled' in body && typeof body.auto_reply_enabled !== 'boolean') {
    return NextResponse.json({ error: 'auto_reply_enabled must be a boolean' }, { status: 400 })
  }
  if ('notify_negative_reviews' in body && typeof body.notify_negative_reviews !== 'boolean') {
    return NextResponse.json({ error: 'notify_negative_reviews must be a boolean' }, { status: 400 })
  }
  if ('auto_reply_delay_hours' in body &&
      (typeof body.auto_reply_delay_hours !== 'number' || !Number.isInteger(body.auto_reply_delay_hours) || body.auto_reply_delay_hours < 1 || body.auto_reply_delay_hours > 24)) {
    return NextResponse.json({ error: 'Delay must be between 1 and 24 hours' }, { status: 400 })
  }
  if ('negative_threshold' in body &&
      (typeof body.negative_threshold !== 'number' || !Number.isInteger(body.negative_threshold) || body.negative_threshold < 1 || body.negative_threshold > 5)) {
    return NextResponse.json({ error: 'Alert threshold must be between 1 and 5 stars' }, { status: 400 })
  }
  if ('reply_persona' in body && body.reply_persona != null && typeof body.reply_persona !== 'string') {
    return NextResponse.json({ error: 'Reply persona must be text' }, { status: 400 })
  }
  if (typeof body.reply_persona === 'string' && body.reply_persona.length > 2000) {
    return NextResponse.json({ error: 'Reply persona is too long' }, { status: 400 })
  }

  // Gate: persona requires Agency plan (only block if a non-empty value is being set)
  if ('reply_persona' in body && body.reply_persona && plan !== 'agency') {
    return NextResponse.json(
      { error: 'Custom reply persona requires Agency plan.' },
      { status: 403 }
    )
  }

  // cuisine_type saves directly to the restaurants table
  if ('cuisine_type' in body) {
    const allowedBusinessTypes = new Set([
      'medical_spa', 'botox_clinic', 'laser_clinic', 'beauty_salon', 'nail_salon',
      'massage_therapy', 'dental_office', 'chiropractor', 'physical_therapy', 'wellness_center',
    ])
    if (body.cuisine_type !== null && (typeof body.cuisine_type !== 'string' || !allowedBusinessTypes.has(body.cuisine_type))) {
      return NextResponse.json({ error: 'Invalid business type' }, { status: 400 })
    }
    const { error } = await admin
      .from('restaurants')
      .update({ cuisine_type: body.cuisine_type ?? null })
      .eq('id', ctx.restaurantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const otherKeys = Object.keys(body).filter(k => k !== 'cuisine_type')
    if (otherKeys.length === 0) return NextResponse.json({ success: true })
  }

  // Gate: report_logo_url requires Agency plan, so update the restaurants table separately
  if ('report_logo_url' in body) {
    if (plan !== 'agency') {
      return NextResponse.json(
        { error: 'Report branding requires Agency plan.' },
        { status: 403 }
      )
    }
    if (body.report_logo_url !== null && typeof body.report_logo_url !== 'string') {
      return NextResponse.json({ error: 'Logo URL must be text' }, { status: 400 })
    }
    if (typeof body.report_logo_url === 'string' && body.report_logo_url) {
      try {
        const url = new URL(body.report_logo_url)
        if (url.protocol !== 'https:') throw new Error('invalid')
        const hostname = url.hostname.toLowerCase()
        const isPrivateHost = hostname === 'localhost'
          || hostname.endsWith('.local')
          || hostname === '::1'
          || /^127\./.test(hostname)
          || /^10\./.test(hostname)
          || /^192\.168\./.test(hostname)
          || /^169\.254\./.test(hostname)
          || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
          || /^(fc|fd|fe80):/i.test(hostname)
        if (isPrivateHost || body.report_logo_url.length > 2048) throw new Error('invalid')
      } catch {
        return NextResponse.json({ error: 'Logo URL must be a valid HTTPS URL' }, { status: 400 })
      }
    }
    const { error } = await admin
      .from('restaurants')
      .update({ report_logo_url: body.report_logo_url })
      .eq('id', ctx.restaurantId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
