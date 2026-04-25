'use client'

type Props = {
  score: number | null
  scoreDelta: number | null
  responseRate: number | null
  avgSentiment: number | null
  topKeywords: string[]
  staffShoutouts: string[]
  hasCompetitors: boolean
  restaurantId: string
  plan?: string
}

function getSentimentDisplay(val: number | null): { label: string; color: string; bg: string } {
  if (val === null) return { label: '—', color: 'var(--t3)', bg: 'transparent' }
  if (val > 0.2) return { label: 'Positive', color: 'var(--ok)', bg: 'var(--ok-sub)' }
  if (val >= -0.2) return { label: 'Neutral', color: 'var(--warn)', bg: 'var(--warn-sub)' }
  return { label: 'Negative', color: 'var(--err)', bg: 'var(--err-sub)' }
}

function ScoreGauge({ score }: { score: number | null }) {
  const pct = score !== null ? Math.max(0, Math.min(100, score)) : 0
  const r = 40
  const cx = 56
  const cy = 52
  const startAngle = -210
  const endAngle = 30
  const totalArc = endAngle - startAngle
  const filled = (pct / 100) * totalArc

  function polarToXY(angle: number, radius: number) {
    const rad = ((angle - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  function describeArc(start: number, end: number, radius: number) {
    const s = polarToXY(start, radius)
    const e = polarToXY(end, radius)
    const large = end - start > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const scoreColor =
    score === null ? 'var(--t3)'
    : score >= 75  ? 'var(--ok)'
    : score >= 50  ? 'var(--warn)'
    : 'var(--err)'

  const glowColor =
    score === null ? 'none'
    : score >= 75  ? 'drop-shadow(0 0 6px rgba(34,197,94,0.5))'
    : score >= 50  ? 'drop-shadow(0 0 6px rgba(245,158,11,0.4))'
    : 'drop-shadow(0 0 6px rgba(239,68,68,0.5))'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="112" height="72" viewBox="0 0 112 72" style={{ overflow: 'visible' }}>
        {/* Track */}
        <path
          d={describeArc(startAngle, endAngle, r)}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {score !== null && (
          <path
            d={describeArc(startAngle, startAngle + filled, r)}
            fill="none"
            stroke={scoreColor}
            strokeWidth="7"
            strokeLinecap="round"
            style={{ filter: glowColor, transition: 'stroke-dasharray 0.6s ease' }}
          />
        )}
        {/* Score text */}
        <text
          x={cx}
          y={cy + 6}
          textAnchor="middle"
          style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', fill: score !== null ? scoreColor : 'var(--t3)', fontFamily: 'inherit' }}
        >
          {score !== null ? Math.round(score) : '—'}
        </text>
        {/* /100 label */}
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          style={{ fontSize: 9, fill: 'var(--t3)', fontFamily: 'inherit' }}
        >
          / 100
        </text>
      </svg>
    </div>
  )
}

function UpgradeCard({ title, sub }: { title: string; sub: string }) {
  return (
    <a
      href="/dashboard/billing"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: '20px 16px', gap: 8, textDecoration: 'none',
        background: 'var(--surface-1)', border: '1px solid var(--border)',
        borderRadius: 16, boxShadow: 'var(--card-shadow)',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'var(--accent-sub)', border: '1px solid oklch(0.62 0.19 258 / 0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>{sub}</p>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-sub)', borderRadius: 6, padding: '3px 10px' }}>
        Upgrade to Growth
      </span>
    </a>
  )
}

export default function IntelligencePanel({
  score,
  scoreDelta,
  responseRate,
  avgSentiment,
  topKeywords,
  staffShoutouts,
  hasCompetitors,
  restaurantId,
  plan,
}: Props) {
  const isStarter = plan === 'starter'
  const sentiment = getSentimentDisplay(avgSentiment)

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '18px 20px',
    boxShadow: 'var(--card-shadow)',
  }

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--t3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 12,
  }

  const responseRatePct = responseRate !== null ? Math.round(responseRate * 100) : null

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Score card */}
      {isStarter ? (
        <UpgradeCard
          title="Reputation Score"
          sub="Track your composite score over time. Available on Growth and above."
        />
      ) : (
        <div style={{ ...cardStyle, padding: '20px 20px 16px' }}>
          <div style={{ ...sectionLabel, marginBottom: 8 }}>Reputation Score</div>
          <ScoreGauge score={score} />

          {scoreDelta !== null && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                color: scoreDelta >= 0 ? 'var(--ok)' : 'var(--err)',
                background: scoreDelta >= 0 ? 'var(--ok-sub)' : 'var(--err-sub)',
                border: `1px solid ${scoreDelta >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
                {scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(scoreDelta)} this week
              </span>
            </div>
          )}

          {/* Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {responseRatePct !== null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>Response rate</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{responseRatePct}%</span>
                </div>
                <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-2)' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, width: `${responseRatePct}%`,
                    background: responseRatePct >= 70 ? 'var(--ok)' : responseRatePct >= 40 ? 'var(--warn)' : 'var(--err)',
                    transition: 'width 0.5s cubic-bezier(0.16,1,0.3,1)',
                  }} />
                </div>
              </div>
            )}

            {avgSentiment !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>Avg sentiment</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                  color: sentiment.color, background: sentiment.bg,
                }}>
                  {sentiment.label}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keywords */}
      {isStarter ? (
        <UpgradeCard
          title="Sentiment Analysis"
          sub="See what customers mention most and track sentiment trends. Available on Growth and above."
        />
      ) : topKeywords.length > 0 ? (
        <div style={cardStyle}>
          <div style={sectionLabel}>Customers mention:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {topKeywords.map((kw, i) => (
              <span
                key={kw}
                style={{
                  fontSize: 12, fontWeight: 500,
                  color: i === 0 ? 'var(--t1)' : 'var(--t2)',
                  background: i === 0 ? 'var(--surface-3)' : 'var(--surface-2)',
                  border: `1px solid ${i === 0 ? 'var(--border-md)' : 'var(--border)'}`,
                  borderRadius: 7, padding: '3px 9px',
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Staff shoutouts */}
      {staffShoutouts.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Team recognized:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {staffShoutouts.map(name => (
              <span
                key={name}
                style={{
                  fontSize: 12, fontWeight: 600,
                  color: 'var(--ok)',
                  background: 'var(--ok-sub)',
                  border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 7, padding: '3px 9px',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Quick links</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            {
              href: '/dashboard/competitors',
              label: 'Competitors',
              sub: 'Monitor nearby restaurants',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ),
            },
            {
              href: '/dashboard/review-requests',
              label: 'Review Requests',
              sub: 'Ask happy customers to review',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              ),
            },
            {
              href: `/api/reports/monthly?restaurantId=${restaurantId}&month=${new Date().toISOString().slice(0, 7)}`,
              label: 'Monthly Report',
              sub: 'Download PDF',
              icon: (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              ),
            },
          ].map(({ href, icon, label, sub }) => (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 11px',
                borderRadius: 9,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border-md)'
                el.style.background = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.borderColor = 'var(--border)'
                el.style.background = 'var(--bg)'
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--t2)',
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{sub}</div>
              </div>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t3)', flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </aside>
  )
}
