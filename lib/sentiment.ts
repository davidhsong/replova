import { getSupabaseAdmin } from '@/lib/supabase'
import { recordUsage } from '@/lib/apiBudget'
import { createStructuredResponse, OPENAI_MODEL } from '@/lib/openai'

export interface SentimentResult {
  score: number
  label: 'positive' | 'neutral' | 'negative'
  summary: string
  keywords: string[]
  staffMentions: string[]
  itemMentions: string[]
}

function fallbackFromRating(rating: number): SentimentResult {
  return {
    score: rating >= 4 ? 0.7 : rating === 3 ? 0.0 : -0.7,
    label: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
    summary: 'Unable to analyze review text.',
    keywords: [],
    staffMentions: [],
    itemMentions: [],
  }
}

export async function analyzeSentiment(
  reviewText: string,
  rating: number
): Promise<SentimentResult> {
  if (!reviewText || !reviewText.trim()) {
    return fallbackFromRating(rating)
  }

  try {
    const { data, inputTokens, outputTokens } = await createStructuredResponse<{
      score: number
      label: SentimentResult['label']
      summary: string
      keywords: string[]
      staffMentions: string[]
      itemMentions: string[]
    }>({
      name: 'review_analysis',
      maxOutputTokens: 512,
      instructions:
        'Analyze customer reviews for any type of local business. Identify the overall sentiment, concise operational themes, named staff, and specific products or services. Keep the summary to one sentence.',
      input: `Rating: ${rating}/5 stars. Review: ${reviewText}`,
      schema: {
        type: 'object',
        properties: {
          score: { type: 'number', minimum: -1, maximum: 1 },
          label: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
          summary: { type: 'string' },
          keywords: { type: 'array', items: { type: 'string' }, maxItems: 12 },
          staffMentions: { type: 'array', items: { type: 'string' }, maxItems: 12 },
          itemMentions: { type: 'array', items: { type: 'string' }, maxItems: 12 },
        },
        required: ['score', 'label', 'summary', 'keywords', 'staffMentions', 'itemMentions'],
        additionalProperties: false,
      },
    })

    await recordUsage(OPENAI_MODEL, 'sentiment', inputTokens, outputTokens)

    if (
      typeof data.score !== 'number' ||
      (data.label !== 'positive' && data.label !== 'neutral' && data.label !== 'negative') ||
      typeof data.summary !== 'string' ||
      !Array.isArray(data.keywords) ||
      !Array.isArray(data.staffMentions) ||
      !Array.isArray(data.itemMentions)
    ) {
      return fallbackFromRating(rating)
    }

    return {
      score: Math.max(-1, Math.min(1, data.score)),
      label: data.label,
      summary: data.summary.slice(0, 500),
      keywords: data.keywords.filter((k: unknown) => typeof k === 'string').slice(0, 12),
      staffMentions: data.staffMentions.filter((k: unknown) => typeof k === 'string').slice(0, 12),
      itemMentions: data.itemMentions.filter((k: unknown) => typeof k === 'string').slice(0, 12),
    }
  } catch {
    return fallbackFromRating(rating)
  }
}

export async function analyzeAndSaveReview(reviewId: string): Promise<SentimentResult> {
  const admin = getSupabaseAdmin()

  const { data: review, error } = await admin
    .from('reviews')
    .select('id, review_text, rating, sentiment_score, sentiment_label, sentiment_summary, keywords, staff_mentions, menu_mentions')
    .eq('id', reviewId)
    .single()

  if (error || !review) {
    throw new Error(`Review not found: ${reviewId}`)
  }

  if (review.sentiment_score !== null && review.sentiment_score !== undefined) {
    return {
      score: review.sentiment_score,
      label: review.sentiment_label as SentimentResult['label'],
      summary: review.sentiment_summary,
      keywords: review.keywords ?? [],
      staffMentions: review.staff_mentions ?? [],
      itemMentions: review.menu_mentions ?? [],
    }
  }

  const result = await analyzeSentiment(review.review_text, review.rating)

  const { error: updateError } = await admin
    .from('reviews')
    .update({
      sentiment_score: result.score,
      sentiment_label: result.label,
      sentiment_summary: result.summary,
      keywords: result.keywords,
      staff_mentions: result.staffMentions,
      menu_mentions: result.itemMentions,
    })
    .eq('id', reviewId)
  if (updateError) throw updateError

  return result
}

export async function batchAnalyzePendingReviews(): Promise<{ processed: number; errors: number }> {
  const admin = getSupabaseAdmin()

  // Only analyze reviews for growth/agency accounts
  const { data: allRestaurants, error: restaurantsError } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .eq('active', true)
  if (restaurantsError) throw restaurantsError

  const emails = [...new Set((allRestaurants ?? []).map(r => r.owner_email))]
  const { data: eligibleAccounts, error: accountsError } = emails.length > 0
    ? await admin.from('accounts').select('owner_email').in('plan', ['growth', 'agency']).in('owner_email', emails)
    : { data: [], error: null }
  if (accountsError) throw accountsError

  const eligibleEmails = new Set(eligibleAccounts?.map(a => a.owner_email) ?? [])
  const eligibleIds = (allRestaurants ?? [])
    .filter(r => eligibleEmails.has(r.owner_email))
    .map(r => r.id)

  if (eligibleIds.length === 0) return { processed: 0, errors: 0 }

  const { data: reviews, error } = await admin
    .from('reviews')
    .select('id, review_text, rating')
    .is('sentiment_score', null)
    .in('restaurant_id', eligibleIds)

  if (error) throw error

  let processed = 0
  let errors = 0

  for (const review of reviews ?? []) {
    if (!review.review_text || !review.review_text.trim()) continue

    try {
      await analyzeAndSaveReview(review.id)
      processed++
    } catch (err) {
      console.error(`Failed to analyze review ${review.id}:`, err)
      errors++
    }

    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  return { processed, errors }
}
