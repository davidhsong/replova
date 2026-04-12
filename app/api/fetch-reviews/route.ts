import { NextRequest, NextResponse } from 'next/server'
import { syncRestaurantReviews } from '@/lib/syncReviews'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const restaurantId: string = body.restaurantId

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  try {
    const result = await syncRestaurantReviews(restaurantId)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`fetch-reviews failed for restaurant ${restaurantId}:`, err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
