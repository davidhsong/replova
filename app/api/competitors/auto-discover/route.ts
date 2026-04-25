import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findNearbyCompetitors } from '@/lib/places'
import { addCompetitor } from '@/lib/competitors'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { restaurantId } = body ?? {}
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Verify ownership
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, place_id')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Check how many slots are left (max 3)
  const { count: existingCount } = await admin
    .from('competitors')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  const slotsLeft = 3 - (existingCount ?? 0)
  if (slotsLeft <= 0) {
    return NextResponse.json({ added: 0, message: 'Already at the 3-competitor limit.' })
  }

  // Get existing competitor place IDs to avoid re-adding
  const { data: existing } = await admin
    .from('competitors')
    .select('google_place_id')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  const alreadyTracked = new Set((existing ?? []).map(c => c.google_place_id))

  const nearby = await findNearbyCompetitors(restaurant.place_id, restaurant.place_id)

  const toAdd = nearby
    .filter(r => !alreadyTracked.has(r.placeId))
    .slice(0, slotsLeft)

  let added = 0
  const errors: string[] = []

  for (const place of toAdd) {
    try {
      await addCompetitor(restaurantId, place.placeId)
      added++
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  return NextResponse.json({ added, errors: errors.length > 0 ? errors : undefined })
}
