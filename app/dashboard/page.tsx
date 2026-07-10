import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import ReviewList from './ReviewList'
import DemoMode from './DemoMode'
import AutoDismissBanner from './AutoDismissBanner'
import IntelligencePanel from '@/components/dashboard/IntelligencePanel'
import StatTile from '@/components/dashboard/StatTile'
import ProviderDashboard from '@/components/dashboard/ProviderDashboard'
import type { Plan } from '@/lib/planLimits'

type Restaurant = {
  id: string
  name: string
  active: boolean
  owner_email: string
  place_id: string | null
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
  rating_score: number | null
  volume_score: number | null
  response_score: number | null
  sentiment_score: number | null
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

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, active, owner_email, place_id, google_location_name, created_at')
    .eq('owner_email', user.email)
    .order('created_at', { ascending: true })
    .returns<Restaurant[]>()

  if (!restaurants || restaurants.length === 0) redirect('/onboard')

  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  const restaurant = restaurants.find(r => r.id === activeId) ?? restaurants[0]

  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'

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
      .select('score, avg_rating, total_reviews, reviews_this_month, response_rate, avg_sentiment, rating_score, volume_score, response_score, sentiment_score, score_date')
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
      {/* Page header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 6 }}>
              <span style={{ color: 'var(--t3)' }}>Workspace</span>
              {' › '}
              <span>Reviews</span>
            </div>
            <h1 className="t-h1" style={{ marginBottom: 4 }}>{restaurant.name}</h1>
            <p className="t-sm c-t3">Auto-syncs every 6h</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Google Business connection banner */}
        {!restaurant.google_location_name && !params.success && (
          <div className="banner banner-warn fade-up" style={{ marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              Connect your Google Business account to sync reviews and enable direct replies.{' '}
              <a href="/dashboard/settings" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
                Go to Settings →
              </a>
            </span>
          </div>
        )}

        {params.success && (
          <AutoDismissBanner className="banner banner-pos fade-up" delay={4000} style={{ marginBottom: 20 }}>
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

        {/* Urgent banner */}
        {urgentCount > 0 && (
          <div className="banner banner-neg fade-up" style={{ marginBottom: 20 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>{urgentCount} negative review{urgentCount > 1 ? 's' : ''} {urgentCount > 1 ? 'need' : 'needs'} a reply</strong>
              <span style={{ color: 'inherit', opacity: 0.8, marginLeft: 8 }}>
                A reply within 24 hours is the difference between recovery and a permanent 1-star.
              </span>
            </div>
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          <StatTile
            label="Replova score"
            value={repScore?.score != null ? Math.round(repScore.score) : '-'}
            delta={scoreDelta !== null ? scoreDelta : undefined}
            sub="vs last week"
          />
          <StatTile
            label="Google rating"
            value={
              displayAvgRating != null
                ? <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 2 }}>
                    {displayAvgRating.toFixed(1)}
                    <span style={{ color: 'var(--gold)', fontSize: 20, lineHeight: 1, marginLeft: 1 }}>★</span>
                  </span>
                : '-'
            }
            sub={`${allRows.length} review${allRows.length !== 1 ? 's' : ''} · last 90 days`}
          />
          <StatTile
            label="New this month"
            value={repScore?.reviews_this_month ?? stats.total}
            sub="this month"
          />
          <StatTile
            label="Awaiting reply"
            value={unrepliedCount}
            urgent={unrepliedCount > 0}
            allClear={unrepliedCount === 0}
            sub={unrepliedCount === 0 ? '✓ All caught up' : `need${unrepliedCount === 1 ? 's' : ''} a reply`}
          />
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 32, alignItems: 'flex-start' }}>
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
            avgRating={displayAvgRating}
            reviewsThisMonth={repScore?.reviews_this_month ?? null}
            responseRate={repScore?.response_rate ?? null}
            avgSentiment={repScore?.avg_sentiment ?? null}
            ratingScore={repScore?.rating_score ?? null}
            volumeScore={repScore?.volume_score ?? null}
            responseScore={repScore?.response_score ?? null}
            sentimentScore={repScore?.sentiment_score ?? null}
            topKeywords={topKeywords}
            staffShoutouts={staffShoutouts}
            hasCompetitors={hasCompetitors}
            restaurantId={restaurant.id}
            plan={plan}
          />
        </div>

        {/* Provider / Team Reputation */}
        <div style={{ marginTop: 40 }}>
          <ProviderDashboard
            restaurantId={restaurant.id}
            plan={plan}
          />
        </div>
      </div>
    </>
  )
}
