import { NextRequest, NextResponse } from 'next/server'
import { getPlaceReviews } from '@/lib/places'
import { generateReplies } from '@/lib/generateReplies'
import { getSupabaseAdmin } from '@/lib/supabase'
import { fetchAllGmbReviews, starRatingToNumber } from '@/lib/myBusiness'

type RestaurantRecord = {
  id: string
  name: string
  place_id: string
  google_location_name: string | null
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
}

type ReviewCandidate = {
  google_review_name: string
  author: string
  rating: number
  review_text: string
  review_timestamp: number
  hasGoogleReply: boolean
}

async function getValidAccessToken(restaurant: RestaurantRecord): Promise<string | null> {
  const fiveMin = 5 * 60 * 1000
  const needsRefresh =
    !restaurant.google_token_expires_at ||
    Date.now() > restaurant.google_token_expires_at - fiveMin

  if (!needsRefresh) return restaurant.google_access_token
  if (!restaurant.google_refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: restaurant.google_refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!res.ok) return null

  const data = await res.json() as { access_token: string; expires_in: number }
  const expiresAt = Date.now() + data.expires_in * 1000

  await getSupabaseAdmin()
    .from('restaurants')
    .update({ google_access_token: data.access_token, google_token_expires_at: expiresAt })
    .eq('id', restaurant.id)

  return data.access_token
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  // Accept restaurantId directly; placeId is kept for legacy callers but unused
  const restaurantId: string = body.restaurantId

  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId is required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, place_id, google_location_name, google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', restaurantId)
    .single<RestaurantRecord>()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  // Load existing reviews for de-dup
  const { data: existingRows } = await admin
    .from('reviews')
    .select('id, google_review_name, review_timestamp, author, status')
    .eq('restaurant_id', restaurantId)

  const existingByGmbName = new Map(
    (existingRows ?? [])
      .filter(r => r.google_review_name)
      .map(r => [r.google_review_name as string, r])
  )
  // Fallback key for old records imported via Places API (no google_review_name)
  const existingByKey = new Map(
    (existingRows ?? []).map(r => [
      `${r.author ?? ''}::${r.review_timestamp ?? ''}`,
      r,
    ])
  )

  let candidates: ReviewCandidate[] = []
  let source: 'gmb' | 'places' = 'places'

  // Prefer My Business API (all reviews + reply detection)
  if (restaurant.google_location_name) {
    const accessToken = await getValidAccessToken(restaurant)
    if (accessToken) {
      try {
        const gmbReviews = await fetchAllGmbReviews(accessToken, restaurant.google_location_name)
        source = 'gmb'
        candidates = gmbReviews.map(r => ({
          google_review_name: r.name,
          author: r.reviewer?.isAnonymous ? 'Anonymous' : (r.reviewer?.displayName ?? 'Anonymous'),
          rating: starRatingToNumber(r.starRating),
          review_text: r.comment ?? '',
          review_timestamp: Math.floor(new Date(r.createTime).getTime() / 1000),
          hasGoogleReply: Boolean(r.reviewReply),
        }))
      } catch (err) {
        console.error('My Business API failed, falling back to Places API:', err)
      }
    }
  }

  // Fall back to Places API (5-review limit, no reply detection)
  if (source === 'places') {
    const placeData = await getPlaceReviews(restaurant.place_id)
    candidates = placeData.reviews.map(r => ({
      google_review_name: '',
      author: r.author,
      rating: r.rating,
      review_text: r.text,
      review_timestamp: r.timestamp,
      hasGoogleReply: false,
    }))
  }

  // Categorize: new vs existing
  const toInsert: ReviewCandidate[] = []
  const toMarkReplied: string[] = []

  for (const c of candidates) {
    let existing = c.google_review_name ? existingByGmbName.get(c.google_review_name) : undefined
    if (!existing) {
      existing = existingByKey.get(`${c.author}::${c.review_timestamp}`)
    }

    if (existing) {
      // Back-fill google_review_name on old records
      if (!existing.google_review_name && c.google_review_name) {
        await admin
          .from('reviews')
          .update({ google_review_name: c.google_review_name })
          .eq('id', existing.id)
      }
      // Auto-mark as replied if Google shows an owner reply
      if (c.hasGoogleReply && existing.status !== 'replied') {
        toMarkReplied.push(existing.id)
      }
    } else {
      toInsert.push(c)
    }
  }

  // Batch auto-reply updates
  if (toMarkReplied.length > 0) {
    await admin
      .from('reviews')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .in('id', toMarkReplied)
  }

  // Insert already-replied reviews (no drafts needed)
  const alreadyReplied = toInsert.filter(r => r.hasGoogleReply)
  if (alreadyReplied.length > 0) {
    await admin.from('reviews').insert(
      alreadyReplied.map(r => ({
        restaurant_id: restaurantId,
        google_review_name: r.google_review_name || null,
        author: r.author,
        rating: r.rating,
        review_text: r.review_text,
        review_timestamp: r.review_timestamp,
        status: 'replied',
        replied_at: new Date().toISOString(),
      }))
    )
  }

  // Insert new reviews that need drafts
  const needDraft = toInsert.filter(r => !r.hasGoogleReply)
  let newlyStored = alreadyReplied.length
  let repliesGenerated = 0

  if (needDraft.length > 0) {
    const { data: inserted } = await admin
      .from('reviews')
      .insert(
        needDraft.map(r => ({
          restaurant_id: restaurantId,
          google_review_name: r.google_review_name || null,
          author: r.author,
          rating: r.rating,
          review_text: r.review_text,
          review_timestamp: r.review_timestamp,
          status: 'pending',
        }))
      )
      .select('id, author, rating, review_text')

    newlyStored += inserted?.length ?? 0

    await Promise.all(
      (inserted ?? []).map(async row => {
        try {
          const replies = await generateReplies({
            restaurantName: restaurant.name,
            author: row.author ?? '',
            rating: row.rating ?? 0,
            reviewText: row.review_text ?? '',
          })

          await admin
            .from('reviews')
            .update({
              reply_draft_1: replies.professional,
              reply_draft_2: replies.warm,
              reply_draft_3: replies.brief,
              status: 'drafted',
            })
            .eq('id', row.id)

          repliesGenerated++
        } catch (err) {
          console.error(`generateReplies failed for review ${row.id}:`, err)
        }
      })
    )
  }

  return NextResponse.json({
    success: true,
    source,
    totalFromGoogle: candidates.length,
    newlyStored,
    autoMarkedReplied: toMarkReplied.length,
    repliesGenerated,
  })
}
