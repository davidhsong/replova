import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { syncRestaurantReviews } from '@/lib/syncReviews'
import { sendWeeklyDigest } from '@/lib/sendDigest'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: restaurants, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, place_id, owner_email')
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let processed = 0
  let errors = 0

  for (const restaurant of restaurants ?? []) {
    try {
      await syncRestaurantReviews(restaurant.id)
      await sendWeeklyDigest(restaurant)
      processed++
    } catch (err) {
      console.error(`Failed to process restaurant ${restaurant.name} (${restaurant.id}):`, err)
      errors++
    }
  }

  return NextResponse.json({ success: true, processed, errors })
}
