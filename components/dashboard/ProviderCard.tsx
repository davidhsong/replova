import type { ProviderStats } from '@/lib/providerStats'

interface ProviderCardProps {
  provider: ProviderStats
  rank: number
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-7)',
  padding: 20,
}

export default function ProviderCard({ provider, rank }: ProviderCardProps) {
  const { name, totalMentions, positiveMentions, negativeMentions, avgRating, recentMentions } = provider

  const posPct = totalMentions > 0 ? (positiveMentions / totalMentions) * 100 : 0
  const negPct = totalMentions > 0 ? (negativeMentions / totalMentions) * 100 : 0
  const neuPct = 100 - posPct - negPct

  return (
    <div style={CARD}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 20, height: 20, borderRadius: 'var(--r-3)',
            background: rank === 1 ? 'var(--gold)' : 'var(--surface-2)',
            color: rank === 1 ? '#fff' : 'var(--t3)',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            #{rank}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>{name}</span>
        </div>
        {recentMentions > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 7px',
            borderRadius: 'var(--r-pill)',
            background: 'var(--pos-sub)', color: 'var(--pos)',
            border: '1px solid var(--pos-line)',
            flexShrink: 0,
          }}>
            +{recentMentions} this month
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', lineHeight: 1 }}>
            {totalMentions}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>reviews</div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', lineHeight: 1 }}>
            {avgRating > 0 ? avgRating.toFixed(1) : '—'}
            {avgRating > 0 && (
              <span style={{ color: 'var(--gold)', fontSize: 16, marginLeft: 2 }}>★</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>avg rating</div>
        </div>
      </div>

      {/* Sentiment bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>Sentiment</span>
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>
            {positiveMentions}↑ · {negativeMentions}↓
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--surface-2)', display: 'flex' }}>
          <div style={{ width: `${posPct}%`, background: 'var(--pos)', height: '100%' }} />
          <div style={{ width: `${negPct}%`, background: 'var(--neg)', height: '100%' }} />
          <div style={{ width: `${neuPct}%`, background: 'var(--surface-3)', height: '100%' }} />
        </div>
      </div>

      {/* Negative warning */}
      {negativeMentions > 0 && (
        <div style={{
          fontSize: 11, color: 'var(--neg)',
          display: 'flex', alignItems: 'center', gap: 4, marginTop: 10,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {negativeMentions} negative mention{negativeMentions > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
