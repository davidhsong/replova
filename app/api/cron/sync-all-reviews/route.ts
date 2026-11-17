import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { syncRestaurantReviews } from '@/lib/syncReviews'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { isGoogleBusinessReviewSyncEnabled } from '@/lib/googleBusinessFeature'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isGoogleBusinessReviewSyncEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: 'google_business_review_sync_disabled',
      synced: 0,
      errors: [],
      totalNewReviews: 0,
    })
  }

  const { data: restaurants, error } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name')
    .eq('active', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let synced = 0
  let totalNewReviews = 0
  const errors: string[] = []

  for (const restaurant of restaurants ?? []) {
    try {
      const result = await syncRestaurantReviews(restaurant.id)
      totalNewReviews += result.newlyStored
      synced++
    } catch (err) {
      const msg = `${restaurant.name} (${restaurant.id}): ${err instanceof Error ? err.message : String(err)}`
      console.error('sync-all-reviews error:', msg)
      errors.push(msg)
    }
  }

  return NextResponse.json({ synced, errors, totalNewReviews })
}
