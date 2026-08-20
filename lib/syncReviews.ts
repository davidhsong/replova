import pLimit from 'p-limit'
import { generateReplies } from '@/lib/generateReplies'
import { getPlaceReviews } from '@/lib/places'
import { fetchAllGmbReviews, starRatingToNumber } from '@/lib/myBusiness'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { sendNegativeReviewAlert } from '@/lib/alerts'

export interface SyncResult {
  source: 'gmb' | 'places'
  totalFromGoogle: number
  newlyStored: number
  autoMarkedReplied: number
  repliesGenerated: number
  draftsFailed: number
}

type RestaurantRecord = {
  id: string
  name: string
  place_id: string | null
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

const AI_CONCURRENCY = 5

export async function syncRestaurantReviews(restaurantId: string): Promise<SyncResult> {
  const admin = getSupabaseAdmin()

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select('id, name, place_id, google_location_name, google_access_token, google_refresh_token, google_token_expires_at')
    .eq('id', restaurantId)
    .single<RestaurantRecord>()

  const { data: settings, error: settingsError } = await admin
    .from('restaurant_settings')
    .select('reply_persona, auto_reply_enabled, auto_reply_delay_hours')
    .eq('restaurant_id', restaurantId)
    .maybeSingle<{ reply_persona: string | null; auto_reply_enabled: boolean; auto_reply_delay_hours: number }>()
  if (settingsError) throw settingsError
  const persona = settings?.reply_persona ?? null

  if (restError || !restaurant) {
    throw new Error('Restaurant not found')
  }

  // Load existing reviews for de-duplication
  const { data: existingRows, error: existingRowsError } = await admin
    .from('reviews')
    .select('id, google_review_name, review_timestamp, author, status')
    .eq('restaurant_id', restaurantId)
  if (existingRowsError) throw existingRowsError

  const existingByGmbName = new Map(
    (existingRows ?? [])
      .filter(r => r.google_review_name)
      .map(r => [r.google_review_name as string, r])
  )
  // Fallback key for old records imported without a google_review_name.
  // Scoped to rows that themselves have no google_review_name — a row that
  // already has its own canonical name is uniquely identified by
  // existingByGmbName above, so it must never be matched here too (two
  // different reviews sharing an author + same-second timestamp, e.g. two
  // "Anonymous" reviewers, would otherwise collide and the newer one would
  // be silently dropped instead of inserted).
  const existingByKey = new Map(
    (existingRows ?? [])
      .filter(r => !r.google_review_name)
      .map(r => [
        `${r.author ?? ''}::${r.review_timestamp ?? ''}`,
        r,
      ])
  )

  let candidates: ReviewCandidate[] = []
  let source: 'gmb' | 'places' = 'places'

  // Prefer Google Business Profile API (returns all reviews + reply status).
  // Once a location is linked, never fall back to the five-review Places sample:
  // sampled rows lack canonical review IDs and would duplicate existing GMB rows.
  if (restaurant.google_location_name) {
    const accessToken = await getValidGoogleToken(restaurant, admin)
    if (!accessToken) throw new Error('Google Business authorization expired. Reconnect in Settings.')

    const gmbReviews = await fetchAllGmbReviews(accessToken, restaurant.google_location_name)
    source = 'gmb'
    candidates = gmbReviews.map(r => ({
      google_review_name: r.name,
      author: r.reviewer?.isAnonymous
        ? 'Anonymous'
        : (r.reviewer?.displayName ?? 'Anonymous'),
      rating: starRatingToNumber(r.starRating),
      review_text: r.comment ?? '',
      review_timestamp: Math.floor(new Date(r.createTime).getTime() / 1000),
      hasGoogleReply: Boolean(r.reviewReply),
    }))
  }

  // Fall back to Places API (hard cap of 5 reviews, no reply detection)
  if (source === 'places') {
    if (!restaurant.place_id) throw new Error('This business is missing its Google Place ID.')
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

  // Categorize each candidate as new vs existing
  const toInsert: ReviewCandidate[] = []
  const toMarkReplied: string[] = []
  const toBackfillName: { id: string; name: string }[] = []

  for (const c of candidates) {
    let existing = c.google_review_name
      ? existingByGmbName.get(c.google_review_name)
      : undefined

    if (!existing) {
      existing = existingByKey.get(`${c.author}::${c.review_timestamp}`)
    }

    if (existing) {
      // Back-fill google_review_name on legacy records
      if (!existing.google_review_name && c.google_review_name) {
        toBackfillName.push({ id: existing.id, name: c.google_review_name })
      }
      // Auto-mark as replied if Google shows a reply already exists
      if (c.hasGoogleReply && existing.status !== 'replied') {
        toMarkReplied.push(existing.id)
      }
    } else {
      toInsert.push(c)
    }
  }

  // Batch back-fill names
  const backfillResults = await Promise.all(
    toBackfillName.map(({ id, name }) =>
      admin.from('reviews').update({ google_review_name: name }).eq('id', id)
    )
  )
  const backfillError = backfillResults.find(result => result.error)?.error
  if (backfillError) throw backfillError

  // Batch auto-reply status updates
  if (toMarkReplied.length > 0) {
    const { error } = await admin
      .from('reviews')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .in('id', toMarkReplied)
    if (error) throw error
  }

  // Insert reviews that already have a Google reply (no AI draft needed).
  // Upsert + ignoreDuplicates guards against a concurrent sync (manual sync
  // racing the cron, or two overlapping cron runs) both treating the same
  // Google review as new and double-inserting it — the DB-level unique
  // index on (restaurant_id, google_review_name) is the source of truth,
  // the in-memory existingByGmbName check above is only a fast-path.
  const alreadyReplied = toInsert.filter(r => r.hasGoogleReply)
  let newlyStored = 0
  if (alreadyReplied.length > 0) {
    const { data: inserted, error } = await admin.from('reviews').upsert(
      alreadyReplied.map(r => ({
        restaurant_id: restaurantId,
        google_review_name: r.google_review_name || null,
        author: r.author,
        rating: r.rating,
        review_text: r.review_text,
        review_timestamp: r.review_timestamp,
        status: 'replied',
        replied_at: new Date().toISOString(),
      })),
      { onConflict: 'restaurant_id,google_review_name', ignoreDuplicates: true }
    ).select('id')
    if (error) throw error
    newlyStored += inserted?.length ?? 0
  }

  // Insert new reviews that need AI drafts
  const needDraft = toInsert.filter(r => !r.hasGoogleReply)
  let repliesGenerated = 0
  let draftsFailed = 0

  if (needDraft.length > 0) {
    // Upsert + ignoreDuplicates: if a concurrent sync already inserted one of
    // these reviews, ON CONFLICT DO NOTHING means it's silently skipped and
    // (critically) NOT returned below — so we never generate a second AI
    // draft or send a second negative-review alert for the same review.
    const conflictTarget = source === 'gmb'
      ? 'restaurant_id,google_review_name'
      : 'restaurant_id,places_dedupe_key'
    const { data: inserted, error: insertError } = await admin
      .from('reviews')
      .upsert(
        needDraft.map(r => ({
          restaurant_id: restaurantId,
          google_review_name: r.google_review_name || null,
          author: r.author,
          rating: r.rating,
          review_text: r.review_text,
          review_timestamp: r.review_timestamp,
          status: 'pending',
        })),
        { onConflict: conflictTarget, ignoreDuplicates: true }
      )
      .select('id, author, rating, review_text, google_review_name')

    if (insertError) throw insertError

    newlyStored += inserted?.length ?? 0

    // Limit concurrent Claude API calls to avoid rate limits
    const limit = pLimit(AI_CONCURRENCY)

    // Each task is independently try/caught so one failure (e.g. a transient
    // Supabase error on the status update) can't reject the whole Promise.all
    // and discard the tally/results for every other review already processed
    // in this batch.
    await Promise.all(
      (inserted ?? []).map(row =>
        limit(async () => {
          try {
            const success = await generateWithRetry({
              restaurantName: restaurant.name,
              author: row.author ?? '',
              rating: row.rating ?? 0,
              reviewText: row.review_text ?? '',
              persona,
            })

            if (success) {
              const { error: draftUpdateError } = await admin
                .from('reviews')
                .update({
                  reply_draft_1: success.professional,
                  reply_draft_2: success.warm,
                  reply_draft_3: success.brief,
                  status: 'drafted',
                })
                .eq('id', row.id)
              if (draftUpdateError) throw draftUpdateError
              repliesGenerated++

              if (settings?.auto_reply_enabled && (row.rating ?? 0) >= 4 && row.google_review_name) {
                const delayHours = settings.auto_reply_delay_hours ?? 2
                const { error: queueError } = await admin.from('reply_queue').insert({
                  review_id: row.id,
                  restaurant_id: restaurantId,
                  generated_reply: success.warm,
                  scheduled_send_at: new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString(),
                  sent: false,
                  approved: null,
                })
                if (queueError) throw queueError
              }
            } else {
              draftsFailed++
              // Status stays 'pending' — visible in UI as "Draft not yet generated"
            }

            await sendNegativeReviewAlert(row.id).catch(err =>
              console.error('Alert failed for review', row.id, err)
            )
          } catch (err) {
            draftsFailed++
            console.error('Failed to process review', row.id, err)
          }
        })
      )
    )
  }

  return {
    source,
    totalFromGoogle: candidates.length,
    newlyStored,
    autoMarkedReplied: toMarkReplied.length,
    repliesGenerated,
    draftsFailed,
  }
}

async function generateWithRetry(
  params: Parameters<typeof generateReplies>[0],
  maxAttempts = 3
): Promise<Awaited<ReturnType<typeof generateReplies>> | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await generateReplies(params)
    } catch (err) {
      const isRateLimit =
        err instanceof Error && (err.message.includes('429') || err.message.toLowerCase().includes('rate'))
      if (attempt < maxAttempts) {
        // Exponential backoff: 2s, 4s, 8s — extra delay for rate limit errors
        const delay = (isRateLimit ? 4000 : 2000) * Math.pow(2, attempt - 1)
        await new Promise(res => setTimeout(res, delay))
      } else {
        console.error(`generateReplies failed after ${maxAttempts} attempts:`, err)
      }
    }
  }
  return null
}
