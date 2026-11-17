'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'

const trendPoints = [
  { label: 'Week 1', value: 34 },
  { label: 'Week 2', value: 48 },
  { label: 'Week 3', value: 41 },
  { label: 'Week 4', value: 62 },
  { label: 'Week 5', value: 72 },
  { label: 'Week 6', value: 91 },
] as const

const chartHeight = 104
const chartWidth = 600
const lineStartDelay = 1250
const segmentDuration = 480
const segmentPause = 140
const pointDuration = 190
const pointLead = 60
const chartPoints = trendPoints
  .map((point, index) => {
    const x = 50 + index * 100
    const y = chartHeight - (point.value / 100) * chartHeight
    return { x, y }
  })

export function AnimatedStoryBarChart() {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const Observer = window.IntersectionObserver
    if (typeof Observer !== 'function') {
      const frame = window.requestAnimationFrame(() => setIsVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    const observer = new Observer(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.35 },
    )

    observer.observe(chart)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={chartRef}
      className="story-visual story-chart"
      role="group"
      aria-label="Illustrative sentiment trend increased twelve percent, with communication improving over time."
    >
      <div>
        <span>Sentiment trend</span>
        <strong className="story-trend-value">+12%</strong>
      </div>
      <div className={`story-bars${isVisible ? ' story-bars-visible' : ''}`}>
        {trendPoints.map((point) => (
          <i
            key={point.label}
            aria-hidden="true"
            style={{ '--bar-height': `${point.value}%` } as CSSProperties}
          />
        ))}

        <svg
          className="story-trend-line"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {chartPoints.slice(0, -1).map((point, index) => {
            const nextPoint = chartPoints[index + 1]
            const segmentStyle = {
              '--segment-delay': `${lineStartDelay + index * (segmentDuration + segmentPause)}ms`,
            } as CSSProperties

            return (
              <line
                key={`${point.x}-${nextPoint.x}`}
                className="story-trend-segment"
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                pathLength="1"
                vectorEffect="non-scaling-stroke"
                style={segmentStyle}
              />
            )
          })}
        </svg>

        {trendPoints.map((point, index) => {
          const delta = index === 0 ? point.value : point.value - trendPoints[index - 1].value
          const deltaTone = index === 0 ? 'neutral' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
          const deltaLabel = index === 0 ? `${delta}` : `${delta > 0 ? '+' : ''}${delta}`
          const pointStyle = {
            '--point-x': `${((index + 0.5) / trendPoints.length) * 100}%`,
            '--point-y': `${point.value}%`,
            '--point-delay': index === 0
              ? `${lineStartDelay - pointDuration}ms`
              : `${lineStartDelay + (index - 1) * (segmentDuration + segmentPause) + segmentDuration - pointLead}ms`,
          } as CSSProperties
          const accessibleChange = index === 0
            ? `baseline sentiment index ${point.value}`
            : `sentiment ${delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'did not change'} by ${Math.abs(delta)} points from the previous week`

          return (
            <button
              key={point.label}
              type="button"
              className="story-chart-point"
              style={pointStyle}
              aria-label={`${point.label}: illustrative ${accessibleChange}`}
              aria-describedby={`story-chart-delta-${index}`}
            >
              <span className="story-chart-point-dot" aria-hidden="true" />
              <span
                id={`story-chart-delta-${index}`}
                className={`story-chart-delta story-chart-delta-${deltaTone}`}
                role="tooltip"
              >
                {deltaLabel}
              </span>
            </button>
          )
        })}
      </div>
      <small>Communication improved after the new handoff process.</small>
    </div>
  )
}
