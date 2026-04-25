import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { addCompetitor } from '@/lib/competitors'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'

async function getAuthedRestaurant(user: { email?: string }, restaurantId: string) {
  const { data } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, owner_email')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .single()
  return data
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const owned = await getAuthedRestaurant(user, restaurantId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = getSupabaseAdmin()
  const { data: competitors } = await admin
    .from('competitors')
    .select('id, name, google_place_id, address, website, price_level, cuisine_tags, source, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('created_at', { ascending: true })

  // Attach latest snapshot to each competitor
  const enriched = await Promise.all(
    (competitors ?? []).map(async (c) => {
      const { data: snap } = await admin
        .from('competitor_snapshots')
        .select('avg_rating, total_reviews, snapshot_date')
        .eq('competitor_id', c.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single()
      return { ...c, latestSnapshot: snap ?? null }
    })
  )

  return NextResponse.json(
    enriched.map(c => ({
      id: c.id,
      name: c.name,
      googlePlaceId: c.google_place_id,
      address: c.address,
      website: c.website ?? null,
      priceLevel: c.price_level ?? null,
      cuisineTags: c.cuisine_tags ?? [],
      source: (c.source ?? 'manual') as 'manual' | 'auto',
      latestSnapshot: c.latestSnapshot,
    }))
  )
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { restaurantId, placeId } = body ?? {}
  if (!restaurantId || !placeId) {
    return NextResponse.json({ error: 'Missing restaurantId or placeId' }, { status: 400 })
  }

  const owned = await getAuthedRestaurant(user, restaurantId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = getSupabaseAdmin()

  // Enforce competitor slot limit for this plan
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  const limits = getPlanLimits(plan)

  const { count: currentCount } = await admin
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if ((currentCount ?? 0) >= limits.competitors) {
    return NextResponse.json(
      { error: 'Competitor limit reached for your plan. Upgrade to track more competitors.' },
      { status: 400 }
    )
  }

  try {
    await addCompetitor(restaurantId, placeId)
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add competitor'
    const status = message.includes('Maximum') ? 422 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  // Bulk clear: ?all=true&restaurantId=...
  if (req.nextUrl.searchParams.get('all') === 'true') {
    const restaurantId = req.nextUrl.searchParams.get('restaurantId')
    if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })
    const owned = await getAuthedRestaurant(user, restaurantId)
    if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await admin.from('competitors').update({ active: false }).eq('restaurant_id', restaurantId).eq('active', true)
    return NextResponse.json({ success: true })
  }

  // Single delete: ?competitorId=...
  const competitorId = req.nextUrl.searchParams.get('competitorId')
  if (!competitorId) return NextResponse.json({ error: 'Missing competitorId' }, { status: 400 })

  const { data: competitor } = await admin
    .from('competitors')
    .select('id, restaurant_id')
    .eq('id', competitorId)
    .single()

  if (!competitor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const owned = await getAuthedRestaurant(user, competitor.restaurant_id)
  if (!owned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await admin.from('competitors').update({ active: false }).eq('id', competitorId)

  return NextResponse.json({ success: true })
}
