import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { calculateFeedbackDemoMetrics, createDemoFeedbackEntries } from '../lib/feedbackDemo'
import {
  aggregateFeedbackByWeek,
  calculateAverageFeedbackRating,
  calculateSentimentRate,
  compareLatestFeedbackPeriods,
  type FeedbackTrendBucket,
} from '../lib/feedbackMetrics'

const fixtureNow = new Date('2026-11-15T18:00:00.000Z')

test('feedback trend uses six chronological seven-day buckets from canonical timestamps', () => {
  const entries = createDemoFeedbackEntries(fixtureNow)
  const shuffled = [...entries].reverse()
  const buckets = aggregateFeedbackByWeek(shuffled, fixtureNow)

  assert.equal(buckets.length, 6)
  assert.deepEqual(buckets.map(bucket => bucket.total), [3, 4, 5, 11, 16, 21])
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.total, 0), 60)
  assert.ok(buckets.every((bucket, index) => (
    index === 0 || new Date(bucket.startAt).getTime() > new Date(buckets[index - 1].startAt).getTime()
  )))
  assert.ok(buckets.every(bucket => (
    bucket.total === bucket.positive + bucket.neutral + bucket.negative
    && (bucket.averageRating === null || (bucket.averageRating >= 1 && bucket.averageRating <= 5))
  )))
})

test('latest-period comparison preserves actual counts and distinguishes percentage change', () => {
  const buckets = aggregateFeedbackByWeek(createDemoFeedbackEntries(fixtureNow), fixtureNow)
  const comparison = compareLatestFeedbackPeriods(buckets)

  assert.deepEqual(comparison, {
    current: 21,
    previous: 16,
    delta: 5,
    percentageChange: 31,
  })
})

test('latest chart period matches the existing rolling seven-day metric at its boundary', () => {
  const boundaryNow = new Date('2026-11-15T16:00:00.000Z')
  const feedback = createDemoFeedbackEntries(boundaryNow)
  const buckets = aggregateFeedbackByWeek(feedback, boundaryNow)
  const metrics = calculateFeedbackDemoMetrics({ feedback, tasks: [] }, boundaryNow)

  assert.equal(buckets.at(-1)?.total, metrics.newFeedback)
  assert.equal(metrics.newFeedback, 24)
})

test('comparison and rates handle missing history and zero denominators safely', () => {
  const emptyBucket = (total: number): FeedbackTrendBucket => ({
    startAt: '2026-11-01T00:00:00.000Z',
    endAt: '2026-11-07T23:59:59.999Z',
    total,
    positive: total,
    neutral: 0,
    negative: 0,
    averageRating: total === 0 ? null : 5,
  })

  assert.equal(compareLatestFeedbackPeriods([]), null)
  assert.equal(compareLatestFeedbackPeriods([emptyBucket(2)]), null)
  assert.deepEqual(compareLatestFeedbackPeriods([emptyBucket(0), emptyBucket(5)]), {
    current: 5,
    previous: 0,
    delta: 5,
    percentageChange: null,
  })
  assert.equal(calculateAverageFeedbackRating([]), null)
  assert.equal(calculateSentimentRate([], 'positive'), 0)
})

test('canonical feedback produces grounded rating and sentiment metrics', () => {
  const entries = createDemoFeedbackEntries(fixtureNow)
  const positiveCount = entries.filter(entry => entry.sentiment === 'positive').length

  assert.equal(calculateAverageFeedbackRating(entries), 3.1)
  assert.equal(calculateSentimentRate(entries, 'positive'), Math.round((positiveCount / 60) * 100))
})

test('chart animation is visibility-gated, finite, reduced-motion safe, and rerender stable', () => {
  const chart = readFileSync('components/dashboard/metrics/FeedbackTrendChart.tsx', 'utf8')
  const css = readFileSync('components/dashboard/metrics/FeedbackTrendChart.module.css', 'utf8')

  assert.match(chart, /IntersectionObserver/)
  assert.match(chart, /hasAnimatedRef\.current/)
  assert.match(chart, /getBoundingClientRect/)
  assert.match(chart, /prefers-reduced-motion: reduce/)
  assert.match(chart, /setAnimationPhase\('complete'\)/)
  assert.match(chart, /1160/)
  assert.match(chart, /<animateMotion dur="1100ms"/)
  assert.match(chart, /pathLength="1000"/)
  assert.match(chart, /tabIndex=\{0\}/)
  assert.match(chart, /Customer feedback trend data/)
  assert.match(css, /@keyframes draw-line/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /infinite/)
})

test('customer names open the existing authorized feedback detail flow', () => {
  const client = readFileSync('app/dashboard/feedback-demo/FeedbackDemoClient.tsx', 'utf8')
  const css = readFileSync('app/dashboard/feedback-demo/FeedbackDemo.module.css', 'utf8')

  assert.match(client, /className=\{styles\.customerNameButton\}/)
  assert.match(client, /aria-label=\{`Open feedback detail for \$\{entry\.customerName\}`\}/)
  assert.match(client, /openRecovery\(entry, event\.currentTarget\)/)
  assert.match(client, /selectedIssue\.requiresRecovery \? 'Customer recovery' : 'Feedback detail'/)
  assert.match(client, /No recovery case is attached to this feedback/)
  assert.match(css, /\.customerNameButton:focus-visible/)
  assert.match(css, /\.trendGrid \{ grid-template-columns: 1fr; \}/)
})
