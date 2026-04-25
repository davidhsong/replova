'use client'

import Link from 'next/link'
import ScoreGauge from './ScoreGauge'
import SentimentStrip from './SentimentStrip'
import { IconArrowUp, IconArrowDown, IconArrowRight, IconLock } from '@/components/icons'
import type { Plan } from '@/lib/planLimits'

type Props = {
  score: number | null
  scoreDelta: number | null
  avgRating?: number | null
  reviewsThisMonth?: number | null
  responseRate: number | null
  avgSentiment: number | null
  ratingScore: number | null
  volumeScore: number | null
  responseScore: number | null
  sentimentScore: number | null
  topKeywords: string[]
  staffShoutouts: string[]
  hasCompetitors: boolean
  restaurantId: string
  plan?: Plan
  sentimentSeries?: number[]
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-7)',
  padding: 20,
}

const EYEBROW: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--t3)',
  marginBottom: 14,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

function UpgradeLock({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      ...CARD,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      textAlign: 'center', padding: '20px 16px', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--r-5)',
        background: 'var(--surface-2)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--t3)',
      }}>
        <IconLock s={14} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{description}</p>
      </div>
      <Link href="/dashboard/billing" style={{
        fontSize: 12, fontWeight: 600, color: 'var(--accent)',
        background: 'var(--accent-sub)', borderRadius: 'var(--r-pill)',
        padding: '4px 12px', border: '1px solid var(--accent-line)',
      }}>
        Upgrade to Growth
      </Link>
    </div>
  )
}

function PanelLink({ href, label, description, isExternal = false }: {
  href: string; label: string; description: string; isExternal?: boolean
}) {
  const inner = (
    <>
      <div style={{ flex: 1 }}>
        <div className="t-eyebrow" style={{ marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--t1)' }}>{description}</div>
      </div>
      <span style={{ color: 'var(--t3)' }}><IconArrowRight s={14} /></span>
    </>
  )
  const shared: React.CSSProperties = {
    ...CARD, display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
  }
  return isExternal
    ? <a href={href} style={shared}>{inner}</a>
    : <Link href={href} style={shared}>{inner}</Link>
}

export default function IntelligencePanel({
  score, scoreDelta,
  avgRating, reviewsThisMonth,
  responseRate, avgSentiment,
  ratingScore, volumeScore, responseScore, sentimentScore,
  topKeywords, staffShoutouts,
  hasCompetitors, restaurantId,
  plan, sentimentSeries,
}: Props) {
  const isStarter = plan === 'starter'
  const reportMonth = new Date().toISOString().slice(0, 7)

  // Use stored breakdown scores when available; otherwise derive with correct formulas
  const bars = {
    rating:    ratingScore    ?? (avgRating        != null ? Math.min(100, Math.round(((avgRating - 1) / 4) * 100))                    : null),
    volume:    volumeScore    ?? (reviewsThisMonth != null ? Math.min(100, Math.round((reviewsThisMonth / 20) * 100))                   : null),
    response:  responseScore  ?? (responseRate     != null ? Math.round(responseRate * 100)                                             : null),
    sentiment: sentimentScore ?? (avgSentiment     != null ? Math.round(((avgSentiment + 1) / 2) * 100)                                : null),
  }

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Score */}
      {isStarter ? (
        <UpgradeLock
          title="Reputation Score"
          description="Track your composite score over time. Available on Growth and above."
        />
      ) : (
        <div style={CARD}>
          <div style={EYEBROW}>
            <span>Replova score</span>
            {scoreDelta !== null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                color: scoreDelta >= 0 ? 'var(--pos)' : 'var(--neg)', fontSize: 11,
              }}>
                {scoreDelta >= 0 ? <IconArrowUp s={10} /> : <IconArrowDown s={10} />}
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta} this week
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <ScoreGauge value={score ?? 0} size={160} mode="arc" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {([
              { l: 'Rating',        v: avgRating        != null ? `${avgRating.toFixed(1)}★`          : '—', s: bars.rating,    w: 35 },
              { l: 'Volume',        v: reviewsThisMonth != null ? `${reviewsThisMonth}/mo`             : '—', s: bars.volume,    w: 20 },
              { l: 'Response rate', v: responseRate     != null ? `${Math.round(responseRate * 100)}%` : '—', s: bars.response,  w: 25 },
              { l: 'Sentiment',     v: avgSentiment     != null ? `${Math.round(((avgSentiment + 1) / 2) * 100)}%` : '—', s: bars.sentiment, w: 20 },
            ] as const).map(r => (
              <div key={r.l}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="t-xs c-t2">{r.l}</span>
                    <span className="t-mono t-xs c-t4">{r.w}%</span>
                  </div>
                  <span className="t-xs tnum" style={{ fontWeight: 600 }}>{r.v}</span>
                </div>
                <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${r.s ?? 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sentiment trend */}
      {!isStarter && sentimentSeries && sentimentSeries.length > 0 && (
        <div style={CARD}>
          <div style={EYEBROW}>
            <span>Sentiment · {sentimentSeries.length} weeks</span>
          </div>
          <SentimentStrip data={sentimentSeries} />
        </div>
      )}

      {/* Keywords */}
      {isStarter ? (
        <UpgradeLock
          title="Sentiment Analysis"
          description="See what customers mention most. Available on Growth and above."
        />
      ) : topKeywords.length > 0 ? (
        <div style={CARD}>
          <div style={EYEBROW}>What customers mention</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topKeywords.map((kw, i) => (
              <span key={kw} style={{
                fontSize: i === 0 ? 14 : 12,
                fontWeight: 500,
                padding: '4px 9px', borderRadius: 'var(--r-pill)',
                background: i === 0 ? 'var(--surface-3)' : 'var(--surface-2)',
                color: i === 0 ? 'var(--t1)' : 'var(--t2)',
                border: `1px solid ${i === 0 ? 'var(--line-md)' : 'var(--line)'}`,
              }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Staff shoutouts */}
      {staffShoutouts.length > 0 && (
        <div style={CARD}>
          <div style={EYEBROW}>Mentioned by name</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {staffShoutouts.map(name => (
              <span key={name} style={{
                fontSize: 12, fontWeight: 600,
                padding: '4px 9px', borderRadius: 'var(--r-pill)',
                background: 'var(--pos-sub)', color: 'var(--pos)',
                border: '1px solid var(--pos-line)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--pos)', color: '#fff',
                  fontSize: 8, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {name[0]}
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      <PanelLink
        href="/dashboard/competitors"
        label="vs. Competitors"
        description={hasCompetitors ? 'View rating comparison' : 'Track nearby restaurants'}
      />

      <PanelLink
        href={`/api/reports/monthly?restaurantId=${restaurantId}&month=${reportMonth}`}
        label="Monthly Report"
        description="Download PDF"
        isExternal
      />
    </aside>
  )
}
