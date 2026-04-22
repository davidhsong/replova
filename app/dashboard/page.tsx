import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import ReviewList from './ReviewList'
import DemoMode from './DemoMode'
import AutoDismissBanner from './AutoDismissBanner'

const PAGE_SIZE = 50

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
}

type ReviewStats = {
  total: number
  needsReply: number
  urgent: number
  avgRating: number | null
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; page?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

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

  // Stats query — counts only, no row data
  const [statsResult, reviewsResult] = await Promise.all([
    admin
      .from('reviews')
      .select('rating, status')
      .eq('restaurant_id', restaurant.id),
    admin
      .from('reviews')
      .select('id, restaurant_id, author, rating, review_text, reply_draft_1, reply_draft_2, reply_draft_3, status, review_timestamp, replied_at, created_at')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<Review[]>(),
  ])

  const allRows = statsResult.data ?? []
  const stats: ReviewStats = {
    total: allRows.length,
    needsReply: allRows.filter(r => r.status !== 'replied').length,
    urgent: allRows.filter(r => r.status !== 'replied' && r.rating != null && r.rating <= 2).length,
    avgRating: allRows.length > 0
      ? allRows.reduce((s, r) => s + (r.rating ?? 0), 0) / allRows.length
      : null,
  }

  const reviews = reviewsResult.data ?? []
  const totalPages = Math.ceil(stats.total / PAGE_SIZE)

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

      <div className="page-wrap">
        {/* Google Business connection banner — hidden on first visit since success banner covers it */}
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

        {/* Success banner — auto-dismisses after 4 s */}
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
          <div className={`banner fade-up ${stats.urgent > 0 ? 'banner-red' : stats.needsReply > 0 ? 'banner-amber' : 'banner-green'}`} style={{ marginBottom: 16 }}>
            {stats.urgent > 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            ) : stats.needsReply > 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            )}
            {stats.urgent > 0
              ? `${stats.urgent} urgent review${stats.urgent > 1 ? 's' : ''} need${stats.urgent === 1 ? 's' : ''} immediate attention`
              : stats.needsReply > 0
              ? `${stats.needsReply} review${stats.needsReply > 1 ? 's' : ''} waiting for a reply`
              : 'All caught up — no reviews waiting for a reply'}
          </div>
        )}

        {/* Empty state → demo mode so users see value immediately */}
        {reviews.length === 0 ? (
          <DemoMode />
        ) : (
          <ReviewList
            reviews={reviews}
            restaurantName={restaurant.name}
            stats={stats}
            currentPage={page}
            totalPages={totalPages}
          />
        )}
      </div>
    </>
  )
}
