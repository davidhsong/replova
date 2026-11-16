import type { DemoFeedbackEntry, FeedbackSentiment } from './feedbackDemo'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

export interface FeedbackTrendBucket {
  startAt: string
  endAt: string
  total: number
  positive: number
  neutral: number
  negative: number
  averageRating: number | null
}

export interface FeedbackPeriodComparison {
  current: number
  previous: number
  delta: number
  percentageChange: number | null
}

export function aggregateFeedbackByWeek(
  entries: readonly DemoFeedbackEntry[],
  now = new Date(),
  periodCount = 6,
): FeedbackTrendBucket[] {
  if (!Number.isInteger(periodCount) || periodCount < 2 || periodCount > 12) {
    throw new Error('Feedback trend period count must be between 2 and 12.')
  }

  const endInclusive = now.getTime()
  const endExclusive = endInclusive + 1
  const firstStart = endInclusive - periodCount * WEEK_MS
  const buckets = Array.from({ length: periodCount }, (_, index) => {
    const start = firstStart + index * WEEK_MS
    const end = index === periodCount - 1 ? endExclusive : start + WEEK_MS
    return {
      startAt: new Date(start).toISOString(),
      endAt: new Date(end - 1).toISOString(),
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      averageRating: null,
      ratingTotal: 0,
    }
  })

  for (const entry of entries) {
    const timestamp = new Date(entry.receivedAt).getTime()
    if (!Number.isFinite(timestamp) || timestamp < firstStart || timestamp >= endExclusive) continue
    const index = Math.min(
      periodCount - 1,
      Math.floor((timestamp - firstStart) / WEEK_MS),
    )
    const bucket = buckets[index]
    if (!bucket) continue
    bucket.total += 1
    bucket[entry.sentiment] += 1
    bucket.ratingTotal += entry.rating
  }

  return buckets.map(({ ratingTotal, ...bucket }) => ({
    ...bucket,
    averageRating: bucket.total === 0
      ? null
      : Math.round((ratingTotal / bucket.total) * 10) / 10,
  }))
}

export function compareLatestFeedbackPeriods(
  buckets: readonly FeedbackTrendBucket[],
): FeedbackPeriodComparison | null {
  if (buckets.length < 2) return null
  const previous = buckets.at(-2)?.total
  const current = buckets.at(-1)?.total
  if (previous === undefined || current === undefined) return null
  const delta = current - previous
  return {
    current,
    previous,
    delta,
    percentageChange: previous === 0 ? null : Math.round((delta / previous) * 100),
  }
}

export function calculateAverageFeedbackRating(entries: readonly DemoFeedbackEntry[]): number | null {
  if (entries.length === 0) return null
  const total = entries.reduce((sum, entry) => sum + entry.rating, 0)
  return Math.round((total / entries.length) * 10) / 10
}

export function calculateSentimentRate(
  entries: readonly DemoFeedbackEntry[],
  sentiment: FeedbackSentiment,
): number {
  if (entries.length === 0) return 0
  const count = entries.filter(entry => entry.sentiment === sentiment).length
  return Math.round((count / entries.length) * 100)
}
