'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FeedbackTrendBucket } from '@/lib/feedbackMetrics'
import {
  createFeedbackTrendTimeline,
  sampleFeedbackTrendTimeline,
} from '@/lib/feedbackTrendAnimation'
import styles from './FeedbackTrendChart.module.css'

type AnimationPhase = 'waiting' | 'running' | 'complete'

const dateLabel = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

function rangeLabel(bucket: FeedbackTrendBucket) {
  return `${dateLabel.format(new Date(bucket.startAt))}–${dateLabel.format(new Date(bucket.endAt))}`
}

export default function FeedbackTrendChart({ buckets }: { buckets: readonly FeedbackTrendBucket[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const markerRef = useRef<SVGCircleElement>(null)
  const revealRectRef = useRef<SVGRectElement>(null)
  const hasAnimatedRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)
  const pausedVertexRef = useRef<number | null>(null)
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('waiting')
  const [pausedVertexIndex, setPausedVertexIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const titleId = useId().replaceAll(':', '')
  const descriptionId = useId().replaceAll(':', '')
  const revealId = `${titleId}-line-reveal`

  const chart = useMemo(() => {
    const width = 620
    const height = 228
    const margin = { top: 30, right: 24, bottom: 38, left: 30 }
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom
    const maxValue = Math.max(1, ...buckets.map(bucket => bucket.total))
    const points = buckets.map((bucket, index) => {
      const x = buckets.length <= 1
        ? margin.left + plotWidth / 2
        : margin.left + (index / (buckets.length - 1)) * plotWidth
      const y = margin.top + plotHeight - (bucket.total / maxValue) * plotHeight
      return { x, y, bucket }
    })
    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    const average = buckets.length === 0
      ? 0
      : buckets.reduce((sum, bucket) => sum + bucket.total, 0) / buckets.length
    const averageY = margin.top + plotHeight - (average / maxValue) * plotHeight
    return { width, height, margin, plotWidth, plotHeight, maxValue, points, path, average, averageY }
  }, [buckets])

  const animationTimeline = useMemo(
    () => chart.points.length >= 2 ? createFeedbackTrendTimeline(chart.points) : null,
    [chart.points],
  )

  useEffect(() => {
    if (
      hasAnimatedRef.current
      || !svgRef.current
      || !pathRef.current
      || !markerRef.current
      || !revealRectRef.current
      || !animationTimeline
    ) return

    const pathElement = pathRef.current
    const markerElement = markerRef.current
    const revealRectElement = revealRectRef.current
    const svgPathLength = pathElement.getTotalLength()
    const lengthScale = animationTimeline.totalLength === 0
      ? 1
      : svgPathLength / animationTimeline.totalLength

    const showCompletedChart = () => {
      revealRectElement.setAttribute('width', String(chart.plotWidth))
      const endpoint = pathElement.getPointAtLength(svgPathLength)
      markerElement.setAttribute('cx', String(endpoint.x))
      markerElement.setAttribute('cy', String(endpoint.y))
      pausedVertexRef.current = null
      setPausedVertexIndex(null)
      setAnimationPhase('complete')
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      hasAnimatedRef.current = true
      const frame = window.requestAnimationFrame(showCompletedChart)
      return () => window.cancelAnimationFrame(frame)
    }

    let observer: IntersectionObserver | null = null
    const beginAnimation = () => {
      if (hasAnimatedRef.current) return
      hasAnimatedRef.current = true

      revealRectElement.setAttribute('width', '0')
      const startPoint = pathElement.getPointAtLength(0)
      markerElement.setAttribute('cx', String(startPoint.x))
      markerElement.setAttribute('cy', String(startPoint.y))
      pausedVertexRef.current = 0
      setPausedVertexIndex(0)
      setAnimationPhase('running')

      let startTime: number | null = null
      const animate = (timestamp: number) => {
        if (startTime === null) startTime = timestamp
        const frame = sampleFeedbackTrendTimeline(
          chart.points,
          animationTimeline,
          timestamp - startTime,
        )
        const visibleLength = frame.length * lengthScale
        const markerPoint = pathElement.getPointAtLength(visibleLength)

        revealRectElement.setAttribute(
          'width',
          String(Math.max(0, markerPoint.x - chart.margin.left)),
        )
        markerElement.setAttribute('cx', String(markerPoint.x))
        markerElement.setAttribute('cy', String(markerPoint.y))

        if (pausedVertexRef.current !== frame.pausedVertexIndex) {
          pausedVertexRef.current = frame.pausedVertexIndex
          setPausedVertexIndex(frame.pausedVertexIndex)
        }

        if (frame.complete) {
          animationFrameRef.current = null
          showCompletedChart()
          return
        }

        animationFrameRef.current = window.requestAnimationFrame(animate)
      }

      animationFrameRef.current = window.requestAnimationFrame(animate)
      observer?.disconnect()
    }

    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) beginAnimation()
    }, { threshold: 0.18 })

    observer.observe(svgRef.current)
    const visibilityCheck = window.setTimeout(() => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect && rect.top < window.innerHeight && rect.bottom > 0) beginAnimation()
    }, 250)

    return () => {
      observer?.disconnect()
      window.clearTimeout(visibilityCheck)
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [animationTimeline, chart.margin.left, chart.plotWidth, chart.points])

  const totalRecords = buckets.reduce((sum, bucket) => sum + bucket.total, 0)
  const endpoint = chart.points.at(-1)
  const activePoint = activeIndex === null ? null : chart.points[activeIndex]
  const pausedPoint = pausedVertexIndex === null ? null : chart.points[pausedVertexIndex]

  return (
    <section className={styles.card} id="feedback-trend" aria-labelledby={`${titleId}-heading`}>
      <header>
        <div>
          <span>Six-week signal</span>
          <h2 id={`${titleId}-heading`}>Customer feedback trend</h2>
        </div>
        <div className={styles.legend} aria-label="Chart legend">
          <span><i /> Feedback received</span>
          <span><i /> Six-week average</span>
        </div>
      </header>

      {totalRecords === 0 ? (
        <div className={styles.empty}>
          <strong>No dated feedback in this period</strong>
          <p>The chart will appear after feedback records include valid timestamps.</p>
        </div>
      ) : (
        <div className={styles.chartWrap}>
          <svg
            ref={svgRef}
            className={styles.chart}
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            role="img"
            aria-labelledby={`${titleId} ${descriptionId}`}
            data-animation={animationPhase}
          >
            <title id={titleId}>Customer feedback received in six chronological seven-day periods</title>
            <desc id={descriptionId}>Each point shows the total feedback received, with keyboard-accessible sentiment and average-rating details.</desc>
            <defs>
              <clipPath id={revealId} clipPathUnits="userSpaceOnUse">
                <rect
                  ref={revealRectRef}
                  x={chart.margin.left}
                  y={0}
                  width={0}
                  height={chart.height}
                />
              </clipPath>
            </defs>

            {[0, 0.5, 1].map(position => {
              const y = chart.margin.top + chart.plotHeight * position
              const value = Math.round(chart.maxValue * (1 - position))
              return (
                <g key={position} className={styles.gridLine}>
                  <line x1={chart.margin.left} x2={chart.margin.left + chart.plotWidth} y1={y} y2={y} />
                  <text x={chart.margin.left} y={y - 6}>{value}</text>
                </g>
              )
            })}

            <g className={styles.averageLine}>
              <line
                x1={chart.margin.left}
                x2={chart.margin.left + chart.plotWidth}
                y1={chart.averageY}
                y2={chart.averageY}
              />
              <text x={chart.margin.left + chart.plotWidth} y={chart.averageY - 7} textAnchor="end">
                Avg {chart.average.toFixed(1)}
              </text>
            </g>

            <path
              ref={pathRef}
              className={styles.trendLine}
              d={chart.path}
              clipPath={`url(#${revealId})`}
              vectorEffect="non-scaling-stroke"
            />

            <circle
              ref={markerRef}
              className={styles.travelingMarker}
              cx={chart.points[0]?.x ?? 0}
              cy={chart.points[0]?.y ?? 0}
              r="4.5"
              aria-hidden="true"
            />

            {chart.points.map((point, index) => {
              const label = `${rangeLabel(point.bucket)}: ${point.bucket.total} feedback records; ${point.bucket.positive} positive, ${point.bucket.neutral} neutral, ${point.bucket.negative} negative; average rating ${point.bucket.averageRating ?? 'not available'}.`
              return (
                <circle
                  key={point.bucket.startAt}
                  className={styles.dataPoint}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  tabIndex={0}
                  focusable="true"
                  data-paused={pausedVertexIndex === index ? 'true' : undefined}
                  aria-label={label}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                >
                  <title>{label}</title>
                </circle>
              )
            })}

            {animationPhase === 'running' && pausedPoint ? (
              <g
                className={styles.pauseValue}
                transform={`translate(${pausedPoint.x} ${pausedPoint.y < 58 ? pausedPoint.y + 22 : pausedPoint.y - 18})`}
                aria-hidden="true"
              >
                <rect x="-14" y="-10" width="28" height="18" rx="5" />
                <text y="3" textAnchor="middle">{pausedPoint.bucket.total}</text>
              </g>
            ) : null}

            {animationPhase === 'complete' && endpoint ? (
              <g className={styles.endpoint} transform={`translate(${endpoint.x} ${endpoint.y})`} aria-hidden="true">
                <circle r="9" />
                <circle r="4" />
              </g>
            ) : null}

            {activePoint ? (
              <g
                className={styles.tooltip}
                transform={`translate(${Math.min(chart.width - 112, Math.max(112, activePoint.x))} ${Math.max(58, activePoint.y - 42)})`}
                pointerEvents="none"
                aria-hidden="true"
              >
                <rect x="-104" y="-32" width="208" height="54" rx="6" />
                <text x="-92" y="-14">{rangeLabel(activePoint.bucket)}</text>
                <text x="-92" y="3">{activePoint.bucket.total} feedback · {activePoint.bucket.averageRating ?? '–'}/5 average</text>
                <text x="-92" y="17">{activePoint.bucket.positive} positive · {activePoint.bucket.negative} negative</text>
              </g>
            ) : null}

            {chart.points.map((point, index) => (
              <text
                key={`${point.bucket.startAt}-label`}
                className={styles.axisLabel}
                x={point.x}
                y={chart.height - 12}
                textAnchor={index === 0 ? 'start' : index === chart.points.length - 1 ? 'end' : 'middle'}
              >
                {dateLabel.format(new Date(point.bucket.endAt))}
              </text>
            ))}
          </svg>

          <p className={styles.chartNote}>
            Seven-day periods derived from the timestamps on the 60 synthetic records. The dashed guide is the actual six-week average, not a target.
          </p>

          <table className={styles.accessibleTable}>
            <caption>Customer feedback trend data</caption>
            <thead><tr><th>Period</th><th>Total</th><th>Positive</th><th>Neutral</th><th>Negative</th><th>Average rating</th></tr></thead>
            <tbody>
              {buckets.map(bucket => (
                <tr key={bucket.startAt}>
                  <th scope="row">{rangeLabel(bucket)}</th>
                  <td>{bucket.total}</td>
                  <td>{bucket.positive}</td>
                  <td>{bucket.neutral}</td>
                  <td>{bucket.negative}</td>
                  <td>{bucket.averageRating ?? 'Not available'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
