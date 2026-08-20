import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findNearbyCompetitors } from '@/lib/places'
import { addCompetitor } from '@/lib/competitors'
import { discoverCompetitorsWithClaude } from '@/lib/discoverCompetitors'
import { getPlanLimits, hasCompetitorTracking } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'

function getGooglePlacesType(businessType: string | null): string {
  const map: Record<string, string> = {
    medical_spa: 'spa',
    botox_clinic: 'beauty_salon',
    laser_clinic: 'beauty_salon',
    beauty_salon: 'beauty_salon',
    nail_salon: 'beauty_salon',
    massage_therapy: 'spa',
    dental_office: 'dentist',
    chiropractor: 'physiotherapist',
    physical_therapy: 'physiotherapist',
    wellness_center: 'health',
  }
  return map[businessType ?? ''] ?? 'establishment'
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { restaurantId } = body ?? {}
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Verify ownership, get business type and name for Claude context
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, place_id, cuisine_type')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .eq('active', true)
    .single<{ id: string; name: string; place_id: string; cuisine_type: string | null }>()

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!restaurant.place_id) {
    return NextResponse.json({ error: 'Business has no Google Place ID. Please reconnect your Google Business profile.' }, { status: 400 })
  }

  // Use plan-based competitor limit
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()
  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  if (!hasCompetitorTracking(plan)) {
    return NextResponse.json({ error: 'Competitor tracking requires Growth or Agency.' }, { status: 403 })
  }
  const slotsTotal = getPlanLimits(plan).competitors

  const { count: existingCount } = await admin
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  const slotsLeft = slotsTotal - (existingCount ?? 0)
  if (slotsLeft <= 0) {
    return NextResponse.json({ added: 0, message: 'Already at the competitor limit for your plan.' })
  }

  // Get existing place IDs to avoid re-adding
  const { data: existing } = await admin
    .from('competitors')
    .select('google_place_id')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
  const alreadyTracked = new Set((existing ?? []).map(c => c.google_place_id))

  // 1. Get up to 20 nearby candidates from Google Places
  const candidates = await findNearbyCompetitors(
    restaurant.place_id,
    restaurant.place_id,
    getGooglePlacesType(restaurant.cuisine_type)
  )

  const fresh = candidates.filter(c => !alreadyTracked.has(c.placeId))
  if (fresh.length === 0) {
    return NextResponse.json({ added: 0, message: 'No new nearby competitors found.' })
  }

  // 2. Use Claude to intelligently rank and select the best competitors
  const selected = await discoverCompetitorsWithClaude(
    { name: restaurant.name, businessType: restaurant.cuisine_type },
    fresh,
    slotsLeft
  )

  // 3. Add selected competitors (full details fetched per place by addCompetitor)
  let added = 0
  let direct = 0
  const errors: string[] = []

  for (const pick of selected) {
    try {
      await addCompetitor(restaurantId, pick.placeId, 'auto')
      added++
      if (pick.competitorType === 'direct') direct++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return NextResponse.json({
    added,
    direct,
    indirect: added - direct,
    errors: errors.length > 0 ? errors : undefined,
  })
}
