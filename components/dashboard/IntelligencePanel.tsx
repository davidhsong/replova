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
}

function getSentimentDisplay(val: number | null): { label: string; color: string } {
  if (val === null) return { label: '—', color: 'var(--t3)' }
  if (val > 0.2) return { label: 'Positive', color: 'var(--ok)' }
  if (val >= -0.2) return { label: 'Neutral', color: 'var(--warn)' }
  return { label: 'Negative', color: 'var(--err)' }
}

export default function IntelligencePanel({
  score,
  responseRate,
  avgSentiment,
  topKeywords,
  staffShoutouts,
  hasCompetitors,
  restaurantId,
}: Props) {
  const sentiment = getSentimentDisplay(avgSentiment)

  const sectionLabel: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--t3)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 12,
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '16px 20px',
  }


  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Section A: Score Breakdown */}
      {score !== null && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Score Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {responseRate !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>Response rate</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                  {Math.round(responseRate * 100)}%
                </span>
              </div>
            )}
            {avgSentiment !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>Avg sentiment</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: sentiment.color }}>
                  {sentiment.label}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section B: Top Keywords */}
      {topKeywords.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Customers keep mentioning:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topKeywords.map(kw => (
              <span
                key={kw}
                style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--t2)',
                  background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                  borderRadius: 8, padding: '4px 10px',
                }}
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section C: Staff Shoutouts */}
      {staffShoutouts.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Team recognized this month:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {staffShoutouts.map(name => (
              <span
                key={name}
                style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--ok)',
                  background: 'var(--ok-sub)', border: '1px solid rgba(34,197,94,0.2)',
                  borderRadius: 8, padding: '3px 10px',
                }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Section D: Quick Links */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Quick Links</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              href: '/dashboard/competitors',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              ),
              label: 'Track Competitors',
              sub: 'Monitor nearby restaurants',
            },
            {
              href: '/dashboard/review-requests',
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              ),
              label: 'Review Requests',
              sub: 'Ask happy customers to review',
            },
            {
              href: `/api/reports/monthly?restaurantId=${restaurantId}&month=${new Date().toISOString().slice(0, 7)}`,
              icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              ),
              label: 'Monthly Report',
              sub: 'Download PDF for this month',
            },
          ].map(({ href, icon, label, sub }) => (
            <a
              key={href}
              href={href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                textDecoration: 'none',
                transition: 'border-color 0.12s, background 0.12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-md)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.background = 'var(--bg)'
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'var(--surface-1)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--t2)',
              }}>
                {icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{sub}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t3)', flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </aside>
  )
}
