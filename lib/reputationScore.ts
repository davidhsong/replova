import { getSupabaseAdmin } from '@/lib/supabase'

export interface ScoreBreakdown {
  ratingScore: number
  volumeScore: number
  responseScore: number
  sentimentScore: number
}

export interface ReputationScoreData {
  score: number | null
  avgRating: number
  totalReviews: number
  reviewsThisMonth: number
  responseRate: number
  avgSentiment: number | null
  breakdown: ScoreBreakdown
}

export async function calculateReputationScore(restaurantId: string): Promise<ReputationScoreData> {
  const admin = getSupabaseAdmin()

  const now = new Date()
  const ninetyDaysAgo = Math.floor(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).getTime() / 1000)

  const { data: reviews } = await admin
    .from('reviews')
    .select('rating, status, review_timestamp, sentiment_score, replied_at')
    .eq('restaurant_id', restaurantId)
    .gte('review_timestamp', ninetyDaysAgo)

  const window = reviews ?? []
  const totalReviews = window.length

  // Component A — Average Rating (35%)
  const avgRating =
    totalReviews === 0
      ? 0
      : window.reduce((sum, r) => sum + r.rating, 0) / totalReviews
  const ratingScore = ((avgRating - 1) / 4) * 100

  // Component B — Review Volume (20%)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthStartTs = Math.floor(monthStart.getTime() / 1000)
  const reviewsThisMonth = window.filter((r) => r.review_timestamp >= monthStartTs).length

  // Prior 3 calendar months
  const priorCounts: number[] = []
  for (let i = 1; i <= 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const startTs = Math.floor(start.getTime() / 1000)
    const endTs = Math.floor(end.getTime() / 1000)
    priorCounts.push(
      window.filter((r) => r.review_timestamp >= startTs && r.review_timestamp < endTs).length
    )
  }
  const avgPrior3 = priorCounts.reduce((a, b) => a + b, 0) / 3
  let volumeScore: number
  if (avgPrior3 === 0) {
    volumeScore = 50
  } else {
    const ratio = Math.min(reviewsThisMonth / avgPrior3, 2.0)
    volumeScore = (ratio / 2.0) * 100
  }

  // Component C — Response Rate (25%)
  const repliedCount = window.filter((r) => r.status === 'replied').length
  const responseRate = totalReviews === 0 ? 0 : repliedCount / totalReviews
  const responseScore = responseRate * 100

  // Component D — Sentiment (20%)
  const sentimentReviews = window.filter(
    (r) => r.sentiment_score !== null && r.sentiment_score !== undefined
  )
  const avgSentiment =
    sentimentReviews.length === 0
      ? null
      : sentimentReviews.reduce((sum, r) => sum + r.sentiment_score, 0) / sentimentReviews.length
  const sentimentScore = avgSentiment === null ? 50 : ((avgSentiment + 1) / 2) * 100

  const breakdown: ScoreBreakdown = {
    ratingScore: Math.round(ratingScore * 10) / 10,
    volumeScore: Math.round(volumeScore * 10) / 10,
    responseScore: Math.round(responseScore * 10) / 10,
    sentimentScore: Math.round(sentimentScore * 10) / 10,
  }

  const rawScore =
    ratingScore * 0.35 + volumeScore * 0.2 + responseScore * 0.25 + sentimentScore * 0.2
  const score = totalReviews < 3 ? null : Math.round(rawScore * 10) / 10

  return {
    score,
    avgRating: Math.round(avgRating * 100) / 100,
    totalReviews,
    reviewsThisMonth,
    responseRate: Math.round(responseRate * 1000) / 1000,
    avgSentiment: avgSentiment === null ? null : Math.round(avgSentiment * 1000) / 1000,
    breakdown,
  }
}

export async function saveReputationSnapshot(restaurantId: string): Promise<ReputationScoreData> {
  const data = await calculateReputationScore(restaurantId)
  const admin = getSupabaseAdmin()

  const today = new Date().toISOString().split('T')[0]

  await admin.from('reputation_scores').upsert(
    {
      restaurant_id: restaurantId,
      score: data.score,
      avg_rating: data.avgRating,
      total_reviews: data.totalReviews,
      reviews_this_month: data.reviewsThisMonth,
      response_rate: data.responseRate,
      avg_sentiment: data.avgSentiment,
      score_date: today,
    },
    { onConflict: 'restaurant_id,score_date' }
  )

  return data
}

export async function getScoreHistory(
  restaurantId: string,
  days: number = 30
): Promise<Array<{ score_date: string; score: number }>> {
  const admin = getSupabaseAdmin()

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data } = await admin
    .from('reputation_scores')
    .select('score_date, score')
    .eq('restaurant_id', restaurantId)
    .gte('score_date', since)
    .not('score', 'is', null)
    .order('score_date', { ascending: true })

  return data ?? []
}

export async function batchSaveAllScores(): Promise<{ updated: number; errors: number }> {
  const admin = getSupabaseAdmin()

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .eq('active', true)

  // Only compute scores for growth/agency accounts
  const emails = [...new Set((restaurants ?? []).map(r => r.owner_email))]
  const { data: eligibleAccounts } = emails.length > 0
    ? await admin.from('accounts').select('owner_email').in('plan', ['growth', 'agency']).in('owner_email', emails)
    : { data: [] }

  const eligibleEmails = new Set(eligibleAccounts?.map(a => a.owner_email) ?? [])
  const eligible = (restaurants ?? []).filter(r => eligibleEmails.has(r.owner_email))

  let updated = 0
  let errors = 0

  for (const restaurant of eligible) {
    try {
      await saveReputationSnapshot(restaurant.id)
      updated++
    } catch (err) {
      console.error(`Failed to save score for restaurant ${restaurant.id}:`, err)
      errors++
    }
  }

  return { updated, errors }
}
