import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { generateSingleReply } from '@/lib/generateSingleReply'

type RestaurantRow = {
  id: string
  name: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
  google_location_name: string | null
}

// ─── Post a reply to a GMB review ──────────────────────────────────────────

export async function postReplyToGmb(
  googleReviewName: string,
  replyText: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`https://mybusiness.googleapis.com/v4/${googleReviewName}/reply`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: replyText }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`GMB reply failed (${res.status}): ${body}`)
  }
}

// ─── Queue a reply for a review ────────────────────────────────────────────

export async function queueReplyForReview(reviewId: string): Promise<{ queueId: string }> {
  const admin = getSupabaseAdmin()

  const { data: review, error: reviewErr } = await admin
    .from('reviews')
    .select('id, restaurant_id, author, rating, review_text')
    .eq('id', reviewId)
    .single<{
      id: string
      restaurant_id: string
      author: string | null
      rating: number | null
      review_text: string | null
    }>()

  if (reviewErr || !review) throw new Error(`Review not found: ${reviewId}`)

  const { data: restaurant, error: restErr } = await admin
    .from('restaurants')
    .select('id, name, google_access_token, google_refresh_token, google_token_expires_at, google_location_name')
    .eq('id', review.restaurant_id)
    .single<RestaurantRow>()

  if (restErr || !restaurant) throw new Error(`Restaurant not found for review ${reviewId}`)

  const { data: settings } = await admin
    .from('restaurant_settings')
    .select('auto_reply_enabled, auto_reply_delay_hours, reply_persona')
    .eq('restaurant_id', restaurant.id)
    .single<{
      auto_reply_enabled: boolean
      auto_reply_delay_hours: number
      reply_persona: string | null
    }>()

  const generatedReply = await generateSingleReply({
    restaurantName: restaurant.name,
    author: review.author ?? 'Guest',
    rating: review.rating ?? 3,
    reviewText: review.review_text ?? '',
    persona: settings?.reply_persona ?? null,
  })

  // Auto-reply only ever covers positive reviews (per Settings copy: "Skip the
  // queue for 4★ and 5★"). Negative/neutral reviews always require manual
  // approval, regardless of the auto_reply_enabled toggle.
  const isPositiveRating = review.rating != null && review.rating >= 4
  let scheduledSendAt: string | null = null
  if (settings?.auto_reply_enabled && isPositiveRating) {
    const delayHours = settings.auto_reply_delay_hours ?? 2
    const sendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000)
    scheduledSendAt = sendAt.toISOString()
  }

  const { data: queued, error: insertErr } = await admin
    .from('reply_queue')
    .insert({
      review_id: review.id,
      restaurant_id: restaurant.id,
      generated_reply: generatedReply,
      edited_reply: null,
      scheduled_send_at: scheduledSendAt,
      sent: false,
      approved: null,
    })
    .select('id')
    .single<{ id: string }>()

  if (insertErr || !queued) throw new Error(`Failed to insert reply_queue: ${insertErr?.message}`)

  return { queueId: queued.id }
}

// ─── Process due queue entries ─────────────────────────────────────────────

export async function processReplyQueue(): Promise<{ sent: number; errors: string[] }> {
  const admin = getSupabaseAdmin()
  const errors: string[] = []
  let sent = 0

  const { data: items, error: fetchErr } = await admin
    .from('reply_queue')
    .select('id, review_id, restaurant_id, generated_reply, edited_reply')
    .eq('sent', false)
    .or('approved.is.null,approved.eq.true')
    .lte('scheduled_send_at', new Date().toISOString())

  if (fetchErr) throw new Error(`Failed to fetch reply_queue: ${fetchErr.message}`)
  if (!items?.length) return { sent: 0, errors: [] }

  for (const item of items) {
    try {
      const { data: restaurant, error: restErr } = await admin
        .from('restaurants')
        .select('id, name, google_access_token, google_refresh_token, google_token_expires_at, google_location_name')
        .eq('id', item.restaurant_id)
        .single<RestaurantRow>()

      if (restErr || !restaurant) {
        errors.push(`[${item.id}] Restaurant not found`)
        continue
      }

      const { data: review, error: revErr } = await admin
        .from('reviews')
        .select('id, google_review_name')
        .eq('id', item.review_id)
        .single<{ id: string; google_review_name: string | null }>()

      if (revErr || !review) {
        errors.push(`[${item.id}] Review not found`)
        continue
      }

      if (!review.google_review_name) {
        errors.push(`[${item.id}] google_review_name is null — cannot post to GMB`)
        continue
      }

      const accessToken = await getValidGoogleToken(restaurant, admin)
      if (!accessToken) {
        errors.push(`[${item.id}] Could not obtain Google access token for restaurant ${restaurant.id}`)
        continue
      }

      const replyText = item.edited_reply ?? item.generated_reply

      await postReplyToGmb(review.google_review_name, replyText, accessToken)

      await admin
        .from('reply_queue')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', item.id)

      await admin
        .from('reviews')
        .update({
          status: 'replied',
          replied_at: new Date().toISOString(),
          owner_reply_text: replyText,
        })
        .eq('id', item.review_id)

      sent++
    } catch (err) {
      errors.push(`[${item.id}] ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { sent, errors }
}
