import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Restaurant = {
  id: string
  place_id: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
  google_location_name: string | null
}

type Review = {
  id: string
  restaurant_id: string
  author: string | null
  review_text: string | null
  google_review_name: string | null
}

async function refreshAccessToken(restaurant: Restaurant): Promise<string | null> {
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

  if (!res.ok) {
    console.error('Token refresh failed:', await res.text())
    return null
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const expiresAt = Date.now() + data.expires_in * 1000

  await getSupabaseAdmin()
    .from('restaurants')
    .update({
      google_access_token: data.access_token,
      google_token_expires_at: expiresAt,
    })
    .eq('id', restaurant.id)

  return data.access_token
}

async function getValidToken(restaurant: Restaurant): Promise<string | null> {
  const fiveMinutes = 5 * 60 * 1000
  const isExpiredOrSoon =
    !restaurant.google_token_expires_at ||
    Date.now() > restaurant.google_token_expires_at - fiveMinutes

  if (isExpiredOrSoon) {
    return refreshAccessToken(restaurant)
  }

  return restaurant.google_access_token
}

/**
 * Find a Google review by matching author name and review text.
 * Returns the Google review resource name on success.
 */
async function findGoogleReview(
  accessToken: string,
  locationName: string,
  author: string | null,
  reviewText: string | null
): Promise<string | null> {
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '50' })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) return null

    const data = (await res.json()) as {
      reviews?: {
        name: string
        reviewer?: { displayName?: string }
        comment?: string
      }[]
      nextPageToken?: string
    }

    const match = data.reviews?.find(gr => {
      const authorMatch =
        (gr.reviewer?.displayName ?? '').trim() === (author ?? '').trim()
      const textMatch =
        (gr.comment ?? '').trim() === (reviewText ?? '').trim()
      return authorMatch && textMatch
    })

    if (match) return match.name

    pageToken = data.nextPageToken
  } while (pageToken)

  return null
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { reviewId?: string; replyText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { reviewId, replyText } = body

  if (!reviewId || typeof reviewId !== 'string') {
    return NextResponse.json({ error: 'reviewId is required' }, { status: 400 })
  }
  if (!replyText || typeof replyText !== 'string' || replyText.trim().length === 0) {
    return NextResponse.json({ error: 'replyText is required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Get restaurant with Google credentials
  const { data: restaurant } = await admin
    .from('restaurants')
    .select(
      'id, place_id, google_access_token, google_refresh_token, google_token_expires_at, google_location_name'
    )
    .eq('owner_email', user.email)
    .single<Restaurant>()

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  if (!restaurant.google_refresh_token) {
    return NextResponse.json(
      { error: 'Google Business not connected', code: 'NOT_CONNECTED' },
      { status: 400 }
    )
  }

  if (!restaurant.google_location_name) {
    return NextResponse.json(
      {
        error:
          'Google Business location not linked. Please reconnect in Settings.',
        code: 'NO_LOCATION',
      },
      { status: 400 }
    )
  }

  // Verify this review belongs to the user's restaurant
  const { data: review } = await admin
    .from('reviews')
    .select('id, restaurant_id, author, review_text, google_review_name')
    .eq('id', reviewId)
    .eq('restaurant_id', restaurant.id)
    .single<Review>()

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  // Get a valid access token (refreshes automatically if needed)
  const accessToken = await getValidToken(restaurant)
  if (!accessToken) {
    return NextResponse.json(
      {
        error: 'Google session expired. Please reconnect in Settings.',
        code: 'TOKEN_INVALID',
      },
      { status: 401 }
    )
  }

  // Find or use cached Google review name
  let googleReviewName = review.google_review_name

  if (!googleReviewName) {
    googleReviewName = await findGoogleReview(
      accessToken,
      restaurant.google_location_name,
      review.author,
      review.review_text
    )

    if (!googleReviewName) {
      return NextResponse.json(
        {
          error:
            'Review not found on Google. It may have been removed or the wrong account is connected.',
        },
        { status: 404 }
      )
    }
  }

  // Post the reply to Google
  const replyRes = await fetch(
    `https://mybusiness.googleapis.com/v4/${googleReviewName}/reply`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment: replyText.trim() }),
    }
  )

  if (!replyRes.ok) {
    let errMessage = 'Unknown error'
    try {
      const errData = await replyRes.json()
      errMessage = errData?.error?.message ?? errMessage
    } catch {
      // ignore parse errors
    }

    if (replyRes.status === 401) {
      return NextResponse.json(
        {
          error: 'Google session expired. Please reconnect in Settings.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      )
    }
    if (replyRes.status === 403) {
      return NextResponse.json(
        {
          error:
            'Not authorized to reply. Make sure you connected the Google account that manages this business.',
        },
        { status: 403 }
      )
    }
    if (replyRes.status === 429) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }
    if (replyRes.status === 404) {
      // Cached name may be stale — clear it and report
      await admin
        .from('reviews')
        .update({ google_review_name: null })
        .eq('id', reviewId)
      return NextResponse.json(
        { error: 'Review no longer exists on Google.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: `Google API error: ${errMessage}` },
      { status: 500 }
    )
  }

  // Success — cache the google_review_name and mark as replied
  await admin
    .from('reviews')
    .update({
      google_review_name: googleReviewName,
      status: 'replied',
      replied_at: new Date().toISOString(),
    })
    .eq('id', reviewId)

  return NextResponse.json({ success: true })
}
