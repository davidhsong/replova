import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'
import DashboardSidebar from './DashboardSidebar'
import TermsModal from './TermsModal'
import Chatbot from './Chatbot'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  // Fetch all locations for this user — include Google fields for chatbot
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, active, google_access_token, google_location_name')
    .eq('owner_email', user.email)
    .order('created_at', { ascending: true })

  if (!restaurants || restaurants.length === 0) redirect('/onboard')

  // Resolve active location from cookie, fall back to first
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  const activeRestaurant = restaurants.find(r => r.id === activeId) ?? restaurants[0]

  // Gate: if account not active, show plan selection — blocks all dashboard routes
  if (!activeRestaurant.active) {
    const plans = [
      {
        key: 'starter', label: 'Starter', price: '$39', sub: '1 location',
        features: ['1 location', '3 competitor slots', 'AI reply drafts', 'Review alerts & digests'],
        primary: false,
      },
      {
        key: 'growth', label: 'Growth', price: '$99', sub: 'Up to 5 locations',
        features: ['Up to 5 locations', '5 competitor slots', 'AI reply drafts', 'Sentiment & scoring', 'PDF reports'],
        primary: true,
      },
      {
        key: 'agency', label: 'Agency', price: '$199', sub: 'Up to 15 locations',
        features: ['Up to 15 locations', '10 competitor slots', 'AI reply drafts', 'Custom persona', 'White-label reports'],
        primary: false,
      },
    ]
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </div>
        </header>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 480 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>Start your free trial</div>
            <h1 className="t-serif" style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 14 }}>Choose your plan</h1>
            <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.6 }}>30 days free — no charge until your trial ends. Cancel anytime.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 860 }}>
            {plans.map(p => (
              <div key={p.key} style={{ border: `1px solid ${p.primary ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 'var(--r-7)', padding: '28px 24px', background: 'var(--surface)', position: 'relative' }}>
                {p.primary && (
                  <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                    Most popular
                  </div>
                )}
                <p style={{ fontSize: 12, fontWeight: 600, color: p.primary ? 'var(--accent)' : 'var(--t3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{p.label}</p>
                <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.02em', marginBottom: 4 }}>
                  {p.price}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--t3)' }}>/mo</span>
                </p>
                <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>{p.sub}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t2)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pos)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href={`/api/create-checkout?plan=${p.key}`} className={`btn btn-block ${p.primary ? 'btn-primary' : 'btn-quiet'}`} style={{ textDecoration: 'none' }}>
                  Start free trial
                </a>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--t3)' }}>
            All plans include a 30-day free trial · <a href="/terms" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>Terms</a>
          </p>
        </main>
      </div>
    )
  }

  // Get account — plan, terms acceptance, stripe id
  const { data: account } = await admin
    .from('accounts')
    .select('plan, terms_accepted_at, stripe_customer_id')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  const limits = getPlanLimits(plan)
  const needsTermsAcceptance = !account?.terms_accepted_at

  // Trial end date: 30 days from first restaurant creation
  const { data: firstRestaurant } = await admin
    .from('restaurants')
    .select('created_at')
    .eq('owner_email', user.email!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const trialEnd = firstRestaurant
    ? new Date(new Date(firstRestaurant.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const trialEndDate = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Stripe subscription — renewal date + status
  let renewalDate: string | null = null
  let subscriptionStatus = 'trialing'
  if (account?.stripe_customer_id) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
      const { data: subs } = await stripe.subscriptions.list({
        customer: account.stripe_customer_id,
        limit: 1,
        status: 'all',
      })
      const sub = subs[0]
      if (sub) {
        subscriptionStatus = sub.status
        // In Stripe v22, current_period_end moved from Subscription to SubscriptionItem
        const periodEnd = sub.items?.data[0]?.current_period_end
        if (periodEnd) {
          renewalDate = new Date(periodEnd * 1000).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric',
          })
        }
      }
    } catch { /* chatbot degrades gracefully without renewal date */ }
  }

  // Parallel: latest reputation score + review counts + settings for active location
  const [latestScoreResult, totalResult, awaitingResult, settingsResult] = await Promise.all([
    admin
      .from('reputation_scores')
      .select('score, avg_rating, total_reviews, reviews_this_month, response_rate, avg_sentiment')
      .eq('restaurant_id', activeRestaurant.id)
      .order('score_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', activeRestaurant.id),
    admin
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', activeRestaurant.id)
      .neq('status', 'replied'),
    admin
      .from('restaurant_settings')
      .select('auto_reply_enabled, auto_reply_delay_hours, reply_persona, notify_negative_reviews, negative_threshold')
      .eq('restaurant_id', activeRestaurant.id)
      .maybeSingle(),
  ])

  const scoreData = latestScoreResult.data
  const settings = settingsResult.data

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? ''
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initials = (displayName || (user.email ?? ''))
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="app">
      <DashboardSidebar
        restaurantName={activeRestaurant.name}
        plan={plan}
        displayName={displayName}
        initials={initials}
        avatarUrl={avatarUrl}
        userEmail={user.email!}
        locations={restaurants}
        activeLocationId={activeRestaurant.id}
        locationLimit={limits.locations}
        awaitingCount={awaitingResult.count ?? 0}
      />
      <main className="main">{children}</main>
      {needsTermsAcceptance && (
        <TermsModal plan={plan} trialEndDate={trialEndDate} />
      )}
      <Chatbot
        restaurantName={activeRestaurant.name}
        userEmail={user.email!}
        plan={plan}
        locationCount={restaurants.length}
        trialEndDate={trialEndDate}
        renewalDate={renewalDate}
        subscriptionStatus={subscriptionStatus}
        googleConnected={!!activeRestaurant.google_access_token}
        googleLocationName={activeRestaurant.google_location_name}
        reputationScore={scoreData?.score ?? null}
        avgRating={scoreData?.avg_rating ?? null}
        totalReviews={totalResult.count ?? scoreData?.total_reviews ?? null}
        reviewsThisMonth={scoreData?.reviews_this_month ?? null}
        responseRate={scoreData?.response_rate ?? null}
        avgSentiment={scoreData?.avg_sentiment ?? null}
        awaitingReplyCount={awaitingResult.count ?? 0}
        autoReplyEnabled={settings?.auto_reply_enabled ?? false}
        autoReplyDelayHours={settings?.auto_reply_delay_hours ?? 1}
        replyPersona={settings?.reply_persona ?? null}
        notifyNegativeReviews={settings?.notify_negative_reviews ?? false}
        negativeThreshold={settings?.negative_threshold ?? 3}
      />
    </div>
  )
}
