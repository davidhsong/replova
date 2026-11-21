import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import ReviewList from '../ReviewList'
import DemoMode from '../DemoMode'
import AutoDismissBanner from '../AutoDismissBanner'
import StatTile from '@/components/dashboard/StatTile'
import type { Plan } from '@/lib/planLimits'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import WorkspaceEmptyState from '../WorkspaceEmptyState'
import styles from '../Overview.module.css'

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
  const restaurant = restaurants.find(location => location.id === activeId && location.active)
    ?? restaurants.find(location => location.active)
    ?? restaurants[0]

  const plan: Plan = account.plan
  const currentDate = new Date()
  const currentTime = currentDate.getTime()
  const sevenDaysAgo = new Date(currentTime - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [repScoreResult, priorScoreResult, reviewsResult, allStatsResult] = await Promise.all([
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

  const unrepliedCount = allRows.filter(row => row.status !== 'replied').length
  const repliedCount = allRows.length - unrepliedCount
  const urgentCount = allRows.filter(row => row.status !== 'replied' && row.rating != null && row.rating <= 2).length
  const positiveCount = allRows.filter(row => row.rating != null && row.rating >= 4).length
  const responseRate = allRows.length > 0 ? Math.round((repliedCount / allRows.length) * 100) : 0
  const nowSeconds = Math.floor(currentTime / 1000)
  const ninetyDaysAgoSeconds = nowSeconds - 90 * 24 * 60 * 60
  const monthStartSeconds = Math.floor(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getTime() / 1000)
  const recentRatedRows = allRows.filter(row => row.rating != null && (row.review_timestamp ?? 0) >= ninetyDaysAgoSeconds)
  const computedAvgRating = recentRatedRows.length > 0
    ? recentRatedRows.reduce((sum, row) => sum + (row.rating ?? 0), 0) / recentRatedRows.length
    : null
  const reviewsThisMonth = allRows.filter(row => (row.review_timestamp ?? 0) >= monthStartSeconds).length
  const scoreDelta = plan !== 'starter' && repScore?.score != null && priorScore?.score != null
    ? Math.round((repScore.score - priorScore.score) * 10) / 10
    : null

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}><span>Workspace</span><span aria-hidden="true">›</span><span>Review center</span></div>
          <h1>{restaurant.name}</h1>
          <p>Review operations · Auto-syncs every 6 hours</p>
        </div>
        <div className={styles.monitoring}><span aria-hidden="true" />Monitoring</div>
      </header>

      <div className={styles.body}>
        {!restaurant.google_location_name && !params.success && (
          <div className={`${styles.banner} ${styles.warningBanner}`}>
            <strong>Google Business is not connected.</strong>
            <span>Connect an authorized profile to sync reviews and enable direct replies.</span>
            <a href="/dashboard/settings">Open settings</a>
          </div>
        )}

        {params.success && (
          <AutoDismissBanner className={`${styles.banner} ${styles.successBanner}`} delay={4000}>
            <strong>You&apos;re all set.</strong>
            <span>Connect Google Business in Settings when you are ready to sync reviews.</span>
            <a href="/dashboard/settings">Open settings</a>
          </AutoDismissBanner>
        )}

        {urgentCount > 0 && (
          <div className={`${styles.banner} ${styles.urgentBanner}`}>
            <strong>{urgentCount} negative review{urgentCount === 1 ? '' : 's'} need{urgentCount === 1 ? 's' : ''} attention</strong>
            <span>Reply while the customer experience is still fresh.</span>
          </div>
        )}

        <section className={styles.stats} aria-label="Review performance summary">
          <StatTile
            label="Replova score"
            value={plan !== 'starter' && repScore?.score != null ? Math.round(repScore.score) : '–'}
            delta={scoreDelta ?? undefined}
            sub={plan === 'starter' ? 'Available on Growth' : 'vs last week'}
          />
          <StatTile
            label="Google rating"
            value={computedAvgRating != null ? (
              <span className={styles.ratingValue}>{computedAvgRating.toFixed(1)}<span aria-hidden="true">★</span></span>
            ) : '–'}
            sub={`${recentRatedRows.length} review${recentRatedRows.length === 1 ? '' : 's'} · last 90 days`}
          />
          <StatTile
            label="New reviews"
            value={repScore?.reviews_this_month ?? reviewsThisMonth}
            sub="received this month"
          />
          <StatTile
            label="Awaiting reply"
            value={unrepliedCount}
            urgent={unrepliedCount > 0}
            allClear={unrepliedCount === 0}
            sub={unrepliedCount === 0 ? 'All caught up' : 'in the response queue'}
          />
        </section>

        <section className={styles.operationsGrid}>
          <div className={styles.reviewWorkspace}>
            <header className={styles.sectionHeader}>
              <div>
                <span>Review inbox</span>
                <h2>Customer feedback and replies</h2>
              </div>
              <small>Latest {reviews.length} records</small>
            </header>
            <div className={styles.reviewContent}>
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

          <aside className={styles.queuePanel} aria-labelledby="queue-health-title">
            <header className={styles.sectionHeader}>
              <div>
                <span>Operations</span>
                <h2 id="queue-health-title">Queue health</h2>
              </div>
            </header>
            <div className={styles.rateBlock}>
              <div><span>Response rate</span><strong>{responseRate}%</strong></div>
              <div className={styles.rateTrack} aria-hidden="true"><span style={{ width: `${responseRate}%` }} /></div>
              <small>{repliedCount} of {allRows.length} reviews marked replied</small>
            </div>
            <dl className={styles.queueMetrics}>
              <div><dt>Urgent</dt><dd data-tone={urgentCount > 0 ? 'negative' : 'positive'}>{urgentCount}</dd></div>
              <div><dt>Awaiting reply</dt><dd>{unrepliedCount}</dd></div>
              <div><dt>Positive ratings</dt><dd data-tone="positive">{positiveCount}</dd></div>
              <div><dt>Total reviews</dt><dd>{allRows.length}</dd></div>
            </dl>
            <div className={styles.scopeNote}>
              <strong>Live workspace data</strong>
              <p>This overview uses only authorized reviews for this location. Synthetic demo records stay isolated in Feedback Demo.</p>
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}
