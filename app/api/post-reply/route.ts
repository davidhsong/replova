import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'

type Restaurant = {
  id: string
  active: boolean
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
  if (replyText.trim().length > 4096) {
    return NextResponse.json({ error: 'replyText exceeds 4096 character limit' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Look up review first, then get restaurant via review.restaurant_id (supports multi-location)
  const { data: review } = await admin
    .from('reviews')
    .select('id, restaurant_id, author, review_text, google_review_name')
    .eq('id', reviewId)
    .maybeSingle<Review>()

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select(
      'id, active, place_id, google_access_token, google_refresh_token, google_token_expires_at, google_location_name'
    )
    .eq('id', review.restaurant_id)
    .eq('owner_email', user.email!)
    .maybeSingle<Restaurant>()

  if (!restaurant) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }
  if (!restaurant.active) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
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
        error: 'Google Business location not linked. Please reconnect in Settings.',
        code: 'NO_LOCATION',
      },
      { status: 400 }
    )
  }

  const accessToken = await getValidGoogleToken(restaurant, admin)
  if (!accessToken) {
    return NextResponse.json(
      {
        error: 'Google session expired. Please reconnect in Settings.',
        code: 'TOKEN_INVALID',
      },
      { status: 401 }
    )
  }

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
        { error: 'Google session expired. Please reconnect in Settings.', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }
    if (replyRes.status === 403) {
      return NextResponse.json(
        { error: 'Not authorized to reply. Make sure you connected the Google account that manages this business.' },
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
      await admin.from('reviews').update({ google_review_name: null }).eq('id', reviewId)
      return NextResponse.json({ error: 'Review no longer exists on Google.' }, { status: 404 })
    }

    return NextResponse.json({ error: `Google API error: ${errMessage}` }, { status: 500 })
  }

  const { error: updateError } = await admin
    .from('reviews')
    .update({
      google_review_name: googleReviewName,
      status: 'replied',
      replied_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
  if (updateError) {
    console.error('Google reply posted but review status update failed:', updateError)
    return NextResponse.json({ error: 'Reply was posted, but the dashboard status is still updating.' }, { status: 202 })
  }

  return NextResponse.json({ success: true })
}
