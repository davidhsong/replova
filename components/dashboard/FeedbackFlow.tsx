'use client'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { flowCounts, flowLabels, flowParent, type FlowKey, type LeafCounts } from '@/lib/pilot/flow'
import styles from './FeedbackFlow.module.css'

const colors: Record<FlowKey, string> = {
  total: '#536eaa',
  written: '#34858a',
  rating: '#77818d',
  issue: '#79659b',
  clear: '#44785a',
  pending: '#957531',
  unavailable: '#76695f',
  urgent: '#a24442',
  other: '#8a714a',
}
const seen = new Set<string>()
type Point = { key: FlowKey; lane: number; size: number; start: number; stage: number }
export default function FeedbackFlow({ leaves, base }: { leaves: LeafCounts; base: string }) {
  const card = useRef<HTMLElement>(null)
  const [hint, setHint] = useState('')
  const counts = flowCounts(leaves)
  const stages: FlowKey[][] = [
    ['total'],
    ['written', 'rating'],
    ['issue', 'clear'],
    ['urgent', 'other'],
  ]
  if (counts.pending) stages[2].push('pending')
  if (counts.unavailable) stages[2].push('unavailable')
  useLayoutEffect(() => {
    const el = card.current
    if (!el || !counts.total) return
    // Record the reveal per tab. Returning from a visit or refreshing keeps the chart settled.
    el.dataset.motion = 'settled'
    const key = 'tap.flow.revealed.v1'
    try {
      if (sessionStorage.getItem(key)) return
    } catch {
      /* storage may be disabled */
    }
    if (
      seen.has(key) ||
      matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.IntersectionObserver
    )
      return
    el.dataset.motion = 'waiting'
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        el.dataset.motion = 'reveal'
        seen.add(key)
        try {
          sessionStorage.setItem(key, '1')
        } catch {
          /* in-memory fallback */
        }
        observer.disconnect()
      },
      { threshold: 0.15 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      delete el.dataset.motion
    }
  }, [counts.total, base])
  function href(key: FlowKey) {
    return (
      base +
      (base.endsWith('?') || base.endsWith('&') ? '' : base.includes('?') ? '&' : '?') +
      'flow=' +
      key +
      '#evidence'
    )
  }
  function summary(key: FlowKey) {
    const parent = flowParent[key]
    return (
      (parent ? flowLabels[parent] + ' → ' : '') +
      flowLabels[key] +
      ' · ' +
      counts[key] +
      (counts[key] === 1 ? ' submission' : ' submissions')
    )
  }
  function chart(mobile: boolean) {
    const unit = (mobile ? 82 : 126) / (counts.total || 1)
    const depth = mobile ? 83 : 214
    const top = mobile ? 3 : 27
    const points = new Map<FlowKey, Point>()
    const position = (x: number, y: number) => (mobile ? [y, x].join(' ') : [x, y].join(' '))
    const childOffsets = new Map<FlowKey, number>()
    stages.forEach((keys, stage) => {
      let lane = mobile ? 5 : 8
      keys.forEach((key) => {
        const size = counts[key] * unit
        points.set(key, { key, stage, lane, size, start: stage * depth + top })
        lane += size + (mobile ? 8 : 49)
      })
    })
    return (
      <svg
        className={mobile ? styles.mobile : styles.desktop}
        viewBox={mobile ? '0 0 312 321' : '0 0 842 ' + (stages[2].length > 2 ? 330 : 234)}
        role="group"
        aria-label="Feedback flow by submission"
      >
        {stages.map((keys, stage) => (
          <g
            key={stage}
            className={styles.stage}
            style={{ '--delay': stage * 290 + 'ms' } as CSSProperties}
          >
            {keys.map((key, index) => {
              const node = points.get(key)!
              const parent = flowParent[key]
              const from = parent && points.get(parent)
              const label = summary(key)
              const interactive = counts[key] > 0
              let band = ''
              if (from && parent && interactive) {
                const x1 = from.start + 7,
                  x2 = node.start,
                  mid = (x1 + x2) / 2
                const y1 = from.lane + (childOffsets.get(parent) || 0),
                  y2 = node.lane,
                  w = node.size
                childOffsets.set(parent, (childOffsets.get(parent) || 0) + w)
                band =
                  'M' +
                  position(x1, y1) +
                  ' C' +
                  position(mid, y1) +
                  ' ' +
                  position(mid, y2) +
                  ' ' +
                  position(x2, y2) +
                  ' L' +
                  position(x2, y2 + w) +
                  ' C' +
                  position(mid, y2 + w) +
                  ' ' +
                  position(mid, y1 + w) +
                  ' ' +
                  position(x1, y1 + w) +
                  ' Z'
              }
              const nx = mobile ? node.lane : node.start,
                ny = mobile ? node.start : node.lane + 20
              // The desktop nodes and ribbons share the same vertical origin.
              const tx = mobile ? 133 : nx,
                ty = mobile ? node.start + index * 17 + 9 : ny - 7
              const graphics = (
                <>
                  <title>{label}</title>
                  {band && (
                    <path
                      data-band={key}
                      d={band}
                      fill={colors[key]}
                      fillOpacity=".23"
                      transform={mobile ? undefined : 'translate(0 20)'}
                    />
                  )}
                  <rect
                    x={nx}
                    y={ny}
                    width={mobile ? Math.max(2, node.size) : 7}
                    height={mobile ? 7 : Math.max(2, node.size)}
                    rx="2.5"
                    fill={colors[key]}
                    opacity={interactive ? 1 : 0.4}
                  />
                  {mobile && interactive && (
                    <rect x={tx - 16} y={ty - 14} width={181} height={17} fill="transparent" />
                  )}
                  {mobile && <circle cx={tx - 10} cy={ty - 4} r="3.5" fill={colors[key]} />}
                  <text x={tx} y={ty} fill="#252b32">
                    {flowLabels[key]}
                    <tspan dx="6" fontWeight="700">
                      {counts[key]}
                    </tspan>
                  </text>
                </>
              )
              return interactive ? (
                <a
                  key={key}
                  href={href(key)}
                  aria-label={label}
                  onFocus={() => setHint(label)}
                  onBlur={() => setHint('')}
                  onMouseEnter={() => setHint(label)}
                  onMouseLeave={() => setHint('')}
                >
                  {graphics}
                </a>
              ) : (
                <g key={key}>{graphics}</g>
              )
            })}
          </g>
        ))}
      </svg>
    )
  }
  return (
    <section id="feedback-flow" ref={card} className={styles.card} aria-labelledby="flow-title">
      <h2 id="flow-title">Feedback flow</h2>
      {counts.total ? (
        <>
          <p>Follow each submission from arrival to outcome. Select a count to see its visits.</p>
          {chart(false)}
          {chart(true)}
          <div className={styles.hint} aria-hidden="true">
            {hint}
          </div>
          <details>
            <summary>View counts as a list</summary>
            <ul>
              {stages.flat().map((key) => (
                <li key={key}>
                  {counts[key] ? <a href={href(key)}>{summary(key)}</a> : summary(key)}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p>No submissions match these filters.</p>
      )}
    </section>
  )
}
