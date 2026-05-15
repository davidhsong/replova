import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendWeeklyDigest } from '@/lib/sendDigest'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
  const { data: disabledSettings } = restaurantIds.length > 0
    ? await admin
        .from('restaurant_settings')
        .select('restaurant_id')
        .in('restaurant_id', restaurantIds)
        .eq('digest_enabled', false)
    : { data: [] as { restaurant_id: string }[] }

  const disabledIds = new Set(disabledSettings?.map(s => s.restaurant_id) ?? [])
  const eligible = (restaurants ?? []).filter(r => !disabledIds.has(r.id))

  let processed = 0
  let errors = 0

  for (const restaurant of eligible) {
    try {
      await sendWeeklyDigest(restaurant)
      processed++
    } catch (err) {
      console.error(`Failed to process restaurant ${restaurant.name} (${restaurant.id}):`, err)
      errors++
    }
  }

  return NextResponse.json({ success: true, processed, errors })
}
