import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import ReviewList from './ReviewList'
import DemoMode from './DemoMode'
import AutoDismissBanner from './AutoDismissBanner'
import StatTile from '@/components/dashboard/StatTile'
import type { Plan } from '@/lib/planLimits'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import WorkspaceEmptyState from './WorkspaceEmptyState'

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

type ReputationScore = {
  score: number | null
  reviews_this_month: number | null
  score_date: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; welcome?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  const account = await getAccountForAuthUser(admin, user)
  if (!account) redirect('/onboard/workspace')

  const { data: workspace } = await admin
    .from('business_workspaces')
    .select('id, name')
    .eq('account_id', account.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!workspace) redirect('/onboard/workspace')

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, active, owner_email, place_id, google_location_name, created_at')
    .eq('owner_email', account.owner_email)
    .order('created_at', { ascending: true })
    .returns<Restaurant[]>()

  if (!restaurants || restaurants.length === 0) {
    return <WorkspaceEmptyState workspaceName={workspace.name} welcome={params.welcome === 'true'} />
  }

  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  const restaurant = restaurants.find(r => r.id === activeId && r.active)
    ?? restaurants.find(r => r.active)
    ?? restaurants[0]

  const plan: Plan = account.plan

  const currentDate = new Date()
  const currentTime = currentDate.getTime()
  const sevenDaysAgo = new Date(currentTime - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    repScoreResult,
    priorScoreResult,
    reviewsResult,
    allStatsResult,
  ] = await Promise.all([
    admin
      .from('reputation_scores')
      .select('score, reviews_this_month, score_date')
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
      .select('rating, status, review_timestamp')
      .eq('restaurant_id', restaurant.id),
  ])

  const repScore = repScoreResult.data
  const priorScore = priorScoreResult.data
  const reviews = reviewsResult.data ?? []
  const allRows = allStatsResult.data ?? []

  const unrepliedCount = allRows.filter(r => r.status !== 'replied').length
  const urgentCount = allRows.filter(r => r.status !== 'replied' && r.rating != null && r.rating <= 2).length
  const nowSeconds = Math.floor(currentTime / 1000)
  const ninetyDaysAgoSeconds = nowSeconds - 90 * 24 * 60 * 60
  const monthStartSeconds = Math.floor(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime() / 1000)
  const recentRatedRows = allRows.filter(r => r.rating != null && (r.review_timestamp ?? 0) >= ninetyDaysAgoSeconds)
  const computedAvgRating = recentRatedRows.length > 0
    ? recentRatedRows.reduce((sum, row) => sum + (row.rating ?? 0), 0) / recentRatedRows.length
    : null
  const reviewsThisMonth = allRows.filter(row => (row.review_timestamp ?? 0) >= monthStartSeconds).length

  const scoreDelta = plan !== 'starter' && repScore?.score != null && priorScore?.score != null
    ? Math.round((repScore.score - priorScore.score) * 10) / 10
    : null

  const displayAvgRating = computedAvgRating

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--pos)', fontSize: 12, fontWeight: 600 }}>
            <span className="pulse-dot" aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pos)', display: 'inline-block' }} />
            Monitoring
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
                Go to Settings
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
                Try to respond within 24 hours while the visit is still fresh.
              </span>
            </div>
          </div>
        )}
        {/* Stats strip */}
        <div className="dashboard-stats">
          <StatTile
            label="Replova score"
            value={plan !== 'starter' && repScore?.score != null ? Math.round(repScore.score) : '-'}
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
            sub={`${recentRatedRows.length} review${recentRatedRows.length !== 1 ? 's' : ''} · last 90 days`}
          />
          <StatTile
            label="New this month"
            value={repScore?.reviews_this_month ?? reviewsThisMonth}
            sub="this month"
          />
          <StatTile
            label="Awaiting reply"
            value={unrepliedCount}
            urgent={unrepliedCount > 0}
            allClear={unrepliedCount === 0}
            sub={unrepliedCount === 0 ? 'All caught up' : `need${unrepliedCount === 1 ? 's' : ''} a reply`}
          />
        </div>

        <div className="dashboard-review-workspace">
          {reviews.length === 0 ? (
            <DemoMode />
          ) : (
            <ReviewList
              reviews={reviews}
              currentPage={1}
              totalPages={1}
              sentimentEnabled={plan !== 'starter'}
            />
          )}
        </div>

      </div>
    </>
  )
}
