import { NextRequest, NextResponse } from 'next/server'
import { syncRestaurantReviews } from '@/lib/syncReviews'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { isGoogleBusinessReviewSyncEnabled } from '@/lib/googleBusinessFeature'

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isGoogleBusinessReviewSyncEnabled()) {
    return NextResponse.json(
      {
        error: 'Google review sync is disabled until API access and permitted usage are confirmed.',
        code: 'GOOGLE_REVIEW_SYNC_DISABLED',
      },
      { status: 503 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const restaurantId: string = body.restaurantId

  if (!restaurantId || typeof restaurantId !== 'string') {
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
