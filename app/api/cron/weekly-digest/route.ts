import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
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
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

      const res = await fetch(`${baseUrl}/api/fetch-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: restaurant.id }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`fetch-reviews failed (${res.status}): ${body}`)
      }

      await sendWeeklyDigest(restaurant)
      processed++
    } catch (err) {
      console.error(`Failed to process restaurant ${restaurant.name} (${restaurant.id}):`, err)
      errors++
    }
  }

  return NextResponse.json({ success: true, processed, errors })
}
