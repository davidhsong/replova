import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { ProviderStats } from '@/lib/providerStats'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const restaurantId = request.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify the restaurant belongs to the authenticated user
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_email', user.email)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

  const { data: reviews } = await admin
    .from('reviews')
    .select('rating, sentiment_label, sentiment_score, staff_mentions, review_timestamp')
    .eq('restaurant_id', restaurantId)
    .not('staff_mentions', 'is', null)

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ providers: [] })
  }

  type Accumulator = {
    totalMentions: number
    positiveMentions: number
    negativeMentions: number
    ratingSum: number
    ratingCount: number
    recentMentions: number
    sentimentSum: number
    sentimentCount: number
  }

  const map = new Map<string, Accumulator>()

  for (const review of reviews) {
    const names = review.staff_mentions as string[] | null
    if (!names || names.length === 0) continue

    for (const name of names) {
      if (!name) continue
      if (!map.has(name)) {
        map.set(name, {
          totalMentions: 0,
          positiveMentions: 0,
          negativeMentions: 0,
          ratingSum: 0,
          ratingCount: 0,
          recentMentions: 0,
          sentimentSum: 0,
          sentimentCount: 0,
        })
      }
      const entry = map.get(name)!
      entry.totalMentions++
      if (review.sentiment_label === 'positive') entry.positiveMentions++
      if (review.sentiment_label === 'negative') entry.negativeMentions++
      if (review.rating != null) {
        entry.ratingSum += review.rating
        entry.ratingCount++
      }
      if (review.review_timestamp != null && review.review_timestamp >= thirtyDaysAgo) {
        entry.recentMentions++
      }
      if (review.sentiment_score != null) {
        entry.sentimentSum += review.sentiment_score as number
        entry.sentimentCount++
      }
    }
  }

  const providers: ProviderStats[] = [...map.entries()]
    .map(([name, data]) => ({
      name,
      totalMentions: data.totalMentions,
      positiveMentions: data.positiveMentions,
      negativeMentions: data.negativeMentions,
      avgRating: data.ratingCount > 0
        ? Math.round((data.ratingSum / data.ratingCount) * 10) / 10
        : 0,
      recentMentions: data.recentMentions,
      sentimentScore: data.sentimentCount > 0
        ? Math.round((data.sentimentSum / data.sentimentCount) * 100) / 100
        : 0,
    }))
    .sort((a, b) => b.totalMentions - a.totalMentions)

  return NextResponse.json({ providers })
}
