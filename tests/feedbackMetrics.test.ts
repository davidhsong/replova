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
import {
  createFeedbackTrendTimeline,
  pointAtTrendLength,
  sampleFeedbackTrendTimeline,
  TREND_FINAL_HOLD_MS,
  TREND_INITIAL_PAUSE_MS,
  TREND_MOVE_MS,
  TREND_VERTEX_PAUSE_MS,
} from '../lib/feedbackTrendAnimation'

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

test('chart animation pauses at all six vertices with one synchronized path distance', () => {
  const points = [
    { x: 0, y: 14 },
    { x: 12, y: 12 },
    { x: 25, y: 9 },
    { x: 38, y: 10 },
    { x: 52, y: 4 },
    { x: 70, y: 0 },
  ]
  const timeline = createFeedbackTrendTimeline(points)
  const pauses = timeline.stages.filter(stage => stage.type === 'pause')
  const movements = timeline.stages.filter(stage => stage.type === 'move')

  assert.equal(pauses.length, 6)
  assert.equal(movements.length, 5)
  assert.equal(pauses[0].endMs - pauses[0].startMs, TREND_INITIAL_PAUSE_MS)
  assert.ok(pauses.slice(1, -1).every(stage => (
    stage.endMs - stage.startMs === TREND_VERTEX_PAUSE_MS
  )))
  assert.equal(pauses.at(-1)!.endMs - pauses.at(-1)!.startMs, TREND_FINAL_HOLD_MS)
  assert.ok(movements.every(stage => stage.endMs - stage.startMs === TREND_MOVE_MS))

  pauses.forEach((stage, vertexIndex) => {
    const frame = sampleFeedbackTrendTimeline(points, timeline, stage.startMs)
    assert.equal(frame.pausedVertexIndex, vertexIndex)
    assert.equal(frame.length, timeline.cumulativeLengths[vertexIndex])
    assert.deepEqual(frame.marker, points[vertexIndex])
  })
})

test('marker coordinate and visible line endpoint agree throughout every movement', () => {
  const points = [
    { x: 0, y: 20 },
    { x: 9, y: 18 },
    { x: 21, y: 13 },
    { x: 34, y: 15 },
    { x: 48, y: 7 },
    { x: 64, y: 2 },
  ]
  const timeline = createFeedbackTrendTimeline(points)
  const movements = timeline.stages.filter(stage => stage.type === 'move')

  for (const stage of movements) {
    for (const progress of [0, 0.25, 0.5, 0.75, 0.999]) {
      const frame = sampleFeedbackTrendTimeline(
        points,
        timeline,
        stage.startMs + TREND_MOVE_MS * progress,
      )
      const lineEndpoint = pointAtTrendLength(
        points,
        timeline.cumulativeLengths,
        frame.length,
      )
      assert.ok(Math.abs(frame.marker.x - lineEndpoint.x) < 0.000001)
      assert.ok(Math.abs(frame.marker.y - lineEndpoint.y) < 0.000001)
    }
  }
})

test('chart animation finishes at point six and has a finite 3.22 second timeline', () => {
  const points = Array.from({ length: 6 }, (_, index) => ({ x: index * 10, y: 20 - index * 3 }))
  const timeline = createFeedbackTrendTimeline(points)
  const finalFrame = sampleFeedbackTrendTimeline(points, timeline, timeline.totalDurationMs)

  assert.equal(timeline.totalDurationMs, 3220)
  assert.equal(finalFrame.complete, true)
  assert.equal(finalFrame.length, timeline.totalLength)
  assert.equal(finalFrame.reachedVertexIndex, 5)
  assert.deepEqual(finalFrame.marker, points[5])
})

test('chart animation is visibility-gated, finite, reduced-motion safe, and cleaned up', () => {
  const chart = readFileSync('components/dashboard/metrics/FeedbackTrendChart.tsx', 'utf8')
  const css = readFileSync('components/dashboard/metrics/FeedbackTrendChart.module.css', 'utf8')

  assert.match(chart, /IntersectionObserver/)
  assert.match(chart, /hasAnimatedRef\.current/)
  assert.match(chart, /getBoundingClientRect/)
  assert.match(chart, /getTotalLength/)
  assert.match(chart, /getPointAtLength\(visibleLength\)/)
  assert.match(chart, /markerPoint\.x - chart\.margin\.left/)
  assert.match(chart, /clipPath=\{`url\(#\$\{revealId\}\)`\}/)
  assert.match(chart, /prefers-reduced-motion: reduce/)
  assert.match(chart, /setAnimationPhase\('complete'\)/)
  assert.match(chart, /cancelAnimationFrame\(animationFrameRef\.current\)/)
  assert.doesNotMatch(chart, /animateMotion|setInterval/)
  assert.match(chart, /tabIndex=\{0\}/)
  assert.match(chart, /Customer feedback trend data/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(css, /@keyframes draw-line|infinite/)
})

test('metric help renders above scroll containers without clipping', () => {
  const metrics = readFileSync('components/dashboard/metrics/DashboardMetrics.tsx', 'utf8')
  const css = readFileSync('components/dashboard/metrics/DashboardMetrics.module.css', 'utf8')

  assert.match(metrics, /createPortal/)
  assert.match(metrics, /document\.body/)
  assert.match(metrics, /window\.addEventListener\('scroll', updatePosition, true\)/)
  assert.match(metrics, /aria-describedby=\{open \? tooltipId : undefined\}/)
  assert.match(css, /\.tooltipPortal\s*\{[\s\S]*position: fixed;/)
  assert.match(css, /\.tooltipPortal\s*\{[\s\S]*z-index: 120;/)
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
