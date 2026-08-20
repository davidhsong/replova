import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from '@/lib/supabase'
import { recordUsage } from '@/lib/apiBudget'

export interface SentimentResult {
  score: number
  label: 'positive' | 'neutral' | 'negative'
  summary: string
  keywords: string[]
  staffMentions: string[]
  treatmentMentions: string[]
}

function fallbackFromRating(rating: number): SentimentResult {
  return {
    score: rating >= 4 ? 0.7 : rating === 3 ? 0.0 : -0.7,
    label: rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative',
    summary: 'Unable to analyze review text.',
    keywords: [],
    staffMentions: [],
    treatmentMentions: [],
  }
}

export async function analyzeSentiment(
  reviewText: string,
  rating: number
): Promise<SentimentResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  if (!reviewText || !reviewText.trim()) {
    return fallbackFromRating(rating)
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:
        'You are a review analyzer for clinics, salons, restaurants, and other local businesses. Return ONLY a valid JSON object with no markdown, ' +
        'no code fences, no explanation. Analyze the review text and return exactly these fields: ' +
        'score (float -1.0 to 1.0), label (positive/neutral/negative), ' +
        'summary (one sentence describing the main sentiment and topics), ' +
        'keywords (array of concise topics such as food quality, service, wait time, cleanliness, atmosphere, value, booking, or results), ' +
        'staffMentions (array of first names of staff mentioned by name), ' +
        'treatmentMentions (array of specific menu items, products, treatments, or services mentioned).',
      messages: [
        {
          role: 'user',
          content: `Rating: ${rating}/5 stars. Review: ${reviewText}`,
        },
      ],
    })

    await recordUsage('claude-haiku-4-5-20251001', 'sentiment', message.usage.input_tokens, message.usage.output_tokens)
    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (
      typeof parsed.score !== 'number' ||
      (parsed.label !== 'positive' && parsed.label !== 'neutral' && parsed.label !== 'negative') ||
      typeof parsed.summary !== 'string' ||
      !Array.isArray(parsed.keywords) ||
      !Array.isArray(parsed.staffMentions) ||
      !Array.isArray(parsed.treatmentMentions)
    ) {
      return fallbackFromRating(rating)
    }

    return {
      score: Math.max(-1, Math.min(1, parsed.score)),
      label: parsed.label,
      summary: parsed.summary.slice(0, 500),
      keywords: parsed.keywords.filter((k: unknown) => typeof k === 'string').slice(0, 12),
      staffMentions: parsed.staffMentions.filter((k: unknown) => typeof k === 'string').slice(0, 12),
      treatmentMentions: parsed.treatmentMentions.filter((k: unknown) => typeof k === 'string').slice(0, 12),
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
      treatmentMentions: review.menu_mentions ?? [],
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
      menu_mentions: result.treatmentMentions,
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
