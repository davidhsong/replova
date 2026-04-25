import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import ReviewList from './ReviewList'
import DemoMode from './DemoMode'
import AutoDismissBanner from './AutoDismissBanner'
import IntelligencePanel from '@/components/dashboard/IntelligencePanel'

type Restaurant = {
  id: string
  name: string
  active: boolean
  owner_email: string
  place_id: string
  stripe_customer_id: string | null
  google_location_name: string | null
  created_at: string
}

type Review = {
  id: string
  restaurant_id: string
  author: string | null
  rating: number | null
  review_text: string | null
  reply_draft_1: string | null
  reply_draft_2: string | null
  reply_draft_3: string | null
  status: string | null
  review_timestamp: number | null
  replied_at: string | null
  created_at: string
  sentiment_label: string | null
}

type ReviewStats = {
  total: number
  needsReply: number
  urgent: number
  avgRating: number | null
}

type ReputationScore = {
  score: number | null
  avg_rating: number | null
  total_reviews: number | null
  reviews_this_month: number | null
  response_rate: number | null
  avg_sentiment: number | null
  score_date: string
}

function getTopKeywords(rows: { keywords: string[] | null }[], limit = 5): string[] {
  const freq = new Map<string, number>()
  for (const row of rows) {
    if (!row.keywords) continue
    for (const kw of row.keywords) {
      if (kw) freq.set(kw, (freq.get(kw) ?? 0) + 1)
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([kw]) => kw)
}

function getStaffShoutouts(rows: { staff_mentions: string[] | null }[]): string[] {
  const names = new Set<string>()
  for (const row of rows) {
    if (!row.staff_mentions) continue
    for (const name of row.staff_mentions) {
      if (name) names.add(name)
    }
  }
  return [...names]
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, active, owner_email, place_id, stripe_customer_id, google_location_name, created_at')
    .eq('owner_email', user.email)
    .single<Restaurant>()

  if (!restaurant) redirect('/onboard')

  if (!restaurant.active) {
    return (
      <>
        <div className="sec-head">
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>
            {restaurant.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Review Center</p>
        </div>
        <div className="page-wrap">
          <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '56px 24px', textAlign: 'center' }} className="fade-up">
            <div style={{
              width: 44, height: 44, background: 'var(--surface-1)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <svg style={{ color: 'var(--t3)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Activate your trial</p>
            <p style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 280, margin: '0 auto 24px', lineHeight: 1.6 }}>
              Start your free 30-day trial to get AI suggested replies for every customer review at{' '}
              <span style={{ color: 'var(--t2)' }}>{restaurant.name}</span>.
            </p>
            <a
              href="/api/create-checkout"
              className="btn-press"
              style={{
                display: 'inline-block', background: 'var(--t1)', color: 'var(--bg)',
                fontSize: 13, fontWeight: 700, padding: '10px 20px', borderRadius: 999,
                textDecoration: 'none',
              }}
            >
              Start your free 30-day trial
            </a>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--t3)' }}>No credit card required · Cancel anytime</p>
          </div>
        </div>
      </>
    )
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    repScoreResult,
    priorScoreResult,
    reviewsResult,
    allStatsResult,
    keywordsResult,
    staffResult,
    competitorsResult,
  ] = await Promise.all([
    admin
      .from('reputation_scores')
      .select('score, avg_rating, total_reviews, reviews_this_month, response_rate, avg_sentiment, score_date')
      .eq('restaurant_id', restaurant.id)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle<ReputationScore>(),
    admin
      .from('reputation_scores')
      .select('score, score_date')
      .eq('restaurant_id', restaurant.id)
      .lte('score_date', sevenDaysAgo)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle<{ score: number; score_date: string }>(),
    admin
      .from('reviews')
      .select('id, restaurant_id, author, rating, review_text, reply_draft_1, reply_draft_2, reply_draft_3, status, review_timestamp, replied_at, created_at, sentiment_label')
      .eq('restaurant_id', restaurant.id)
      .order('review_timestamp', { ascending: false, nullsFirst: false })
      .limit(25)
      .returns<Review[]>(),
    admin
      .from('reviews')
      .select('rating, status')
      .eq('restaurant_id', restaurant.id),
    admin
      .from('reviews')
      .select('keywords')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', thirtyDaysAgo)
      .not('keywords', 'is', null),
    admin
      .from('reviews')
      .select('staff_mentions')
      .eq('restaurant_id', restaurant.id)
      .eq('sentiment_label', 'positive')
      .gte('created_at', thirtyDaysAgo)
      .not('staff_mentions', 'is', null),
    admin
      .from('competitors')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('active', true),
  ])

  const repScore = repScoreResult.data
  const priorScore = priorScoreResult.data
  const reviews = reviewsResult.data ?? []
  const allRows = allStatsResult.data ?? []

  const unrepliedCount = allRows.filter(r => r.status !== 'replied').length
  const urgentCount = allRows.filter(r => r.status !== 'replied' && r.rating != null && r.rating <= 2).length
  const computedAvgRating = allRows.length > 0
    ? allRows.reduce((s, r) => s + (r.rating ?? 0), 0) / allRows.length
    : null

  const stats: ReviewStats = {
    total: allRows.length,
    needsReply: unrepliedCount,
    urgent: urgentCount,
    avgRating: computedAvgRating,
  }

  const topKeywords = getTopKeywords((keywordsResult.data ?? []) as { keywords: string[] | null }[])
  const staffShoutouts = getStaffShoutouts((staffResult.data ?? []) as { staff_mentions: string[] | null }[])
  const hasCompetitors = (competitorsResult.count ?? 0) > 0

  const scoreDelta = repScore?.score != null && priorScore?.score != null
    ? Math.round((repScore.score - priorScore.score) * 10) / 10
    : null

  const displayAvgRating = repScore?.avg_rating ?? computedAvgRating

  return (
    <>
      {/* Section header */}
      <div className="sec-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>
            {restaurant.name}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Review Center</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-green pulse-dot" />
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>Monitoring</span>
        </div>
      </div>

      <div className="page-wrap" style={{ maxWidth: 1080 }}>
        {/* Google Business connection banner */}
        {!restaurant.google_location_name && !params.success && (
          <div className="banner banner-amber fade-up" style={{ marginBottom: 16 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              Connect your Google Business account to sync all reviews and enable direct replies.{' '}
              <a href="/dashboard/settings" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
                Go to Settings →
              </a>
            </span>
          </div>
        )}

        {/* Success banner */}
        {params.success && (
          <AutoDismissBanner className="banner banner-green fade-up" delay={4000}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            You&apos;re all set. Connect your Google Business in{' '}
            <a href="/dashboard/settings" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
              Settings
            </a>{' '}
            to start syncing reviews.
          </AutoDismissBanner>
        )}

        {/* Urgent / all-clear banner */}
        {stats.total > 0 && (
          <div
            className={`banner fade-up ${urgentCount > 0 ? 'banner-red' : unrepliedCount > 0 ? 'banner-amber' : 'banner-green'}`}
            style={{ marginBottom: 16 }}
          >
            {urgentCount > 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ) : unrepliedCount > 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            )}
            {urgentCount > 0
              ? `${urgentCount} urgent review${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} immediate attention`
              : unrepliedCount > 0
              ? `${unrepliedCount} review${unrepliedCount > 1 ? 's' : ''} waiting for a reply`
              : 'All caught up — no reviews waiting for a reply'}
          </div>
        )}

        {/* Row 1: Stats strip */}
        <div className="stats-strip fade-up" style={{ marginBottom: 20 }}>
          {/* Card 1: Reputation Score */}
          <div className="stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Replova Score</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--t1)', lineHeight: 1 }}>
              {repScore?.score != null ? Math.round(repScore.score) : '—'}
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t3)', letterSpacing: 0 }}> /100</span>
            </div>
            <div style={{ marginTop: 8 }}>
              {scoreDelta !== null ? (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 5,
                  color: scoreDelta >= 0 ? 'var(--ok)' : 'var(--err)',
                  background: scoreDelta >= 0 ? 'var(--ok-sub)' : 'var(--err-sub)',
                }}>
                  {scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(scoreDelta)} this week
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>syncing…</span>
              )}
            </div>
          </div>

          {/* Card 2: Avg Rating */}
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Google Rating</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', color: '#f59e0b', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 3 }}>
              {displayAvgRating != null ? displayAvgRating.toFixed(1) : '—'}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none" style={{ marginBottom: 1, flexShrink: 0 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: 'var(--t3)' }}>last 90 days</div>
          </div>

          {/* Card 3: Reviews This Month */}
          <div className="stat-card">
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>New Reviews</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', color: 'var(--t1)', lineHeight: 1 }}>
              {repScore?.reviews_this_month ?? stats.total}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: 'var(--t3)' }}>this month</div>
          </div>

          {/* Card 4: Need Reply */}
          <div
            className="stat-card"
            style={unrepliedCount > 0 ? { background: 'var(--err-sub)', borderColor: 'rgba(239,68,68,0.18)' } : {}}
          >
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Awaiting Reply</div>
            <div style={{
              fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1,
              color: unrepliedCount > 0 ? 'var(--err)' : 'var(--ok)',
            }}>
              {unrepliedCount}
            </div>
            <div style={{ fontSize: 11, marginTop: 8, color: 'var(--t3)' }}>
              {unrepliedCount === 0 ? '✓ all caught up' : `need${unrepliedCount === 1 ? 's' : ''} a reply`}
            </div>
          </div>
        </div>

        {/* Row 2: Review inbox + Intelligence panel */}
        <div className="intel-grid">
          <div style={{ minWidth: 0 }}>
            {reviews.length === 0 ? (
              <DemoMode />
            ) : (
              <ReviewList
                reviews={reviews}
                restaurantName={restaurant.name}
                stats={stats}
                currentPage={1}
                totalPages={1}
              />
            )}
          </div>
          <IntelligencePanel
            score={repScore?.score ?? null}
            scoreDelta={scoreDelta}
            responseRate={repScore?.response_rate ?? null}
            avgSentiment={repScore?.avg_sentiment ?? null}
            topKeywords={topKeywords}
            staffShoutouts={staffShoutouts}
            hasCompetitors={hasCompetitors}
            restaurantId={restaurant.id}
          />
        </div>
      </div>
    </>
  )
}
