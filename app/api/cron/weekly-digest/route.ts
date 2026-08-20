import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendWeeklyDigest } from '@/lib/sendDigest'
import { isAuthorizedCron } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  const { data: restaurants, error } = await admin
    .from('restaurants')
    .select('id, name, place_id, owner_email')
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Respect the user's digest_enabled preference
  const restaurantIds = (restaurants ?? []).map(r => r.id)
  const { data: disabledSettings, error: settingsError } = restaurantIds.length > 0
    ? await admin
        .from('restaurant_settings')
        .select('restaurant_id')
        .in('restaurant_id', restaurantIds)
        .eq('digest_enabled', false)
    : { data: [] as { restaurant_id: string }[], error: null }
  if (settingsError) {
    return NextResponse.json({ error: 'Unable to load digest preferences.' }, { status: 500 })
  }

  const disabledIds = new Set(disabledSettings?.map(s => s.restaurant_id) ?? [])
  const eligible = (restaurants ?? []).filter(r => !disabledIds.has(r.id))

  let processed = 0
  let errors = 0
  const now = new Date()
  const day = now.getUTCDay()
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((day + 6) % 7)))
  const weekStart = monday.toISOString().slice(0, 10)

  for (const restaurant of eligible) {
    await admin
      .from('digest_deliveries')
      .delete()
      .eq('restaurant_id', restaurant.id)
      .eq('week_start', weekStart)
      .is('delivered_at', null)
      .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    const { error: claimError } = await admin.from('digest_deliveries').insert({
      restaurant_id: restaurant.id,
      week_start: weekStart,
    })
    if (claimError?.code === '23505') continue
    if (claimError) {
      console.error(`Failed to claim weekly digest for ${restaurant.id}:`, claimError)
      errors++
      continue
    }
    try {
      await sendWeeklyDigest(restaurant)
      const { error: deliveryUpdateError } = await admin
        .from('digest_deliveries')
        .update({ delivered_at: new Date().toISOString() })
        .eq('restaurant_id', restaurant.id)
        .eq('week_start', weekStart)
      if (deliveryUpdateError) throw deliveryUpdateError
      processed++
    } catch (err) {
      console.error(`Failed to process restaurant ${restaurant.name} (${restaurant.id}):`, err)
      await admin
        .from('digest_deliveries')
        .delete()
        .eq('restaurant_id', restaurant.id)
        .eq('week_start', weekStart)
      errors++
    }
  }

  return NextResponse.json({ success: true, processed, errors })
}
