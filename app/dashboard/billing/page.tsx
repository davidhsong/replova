import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

type Account = {
  plan: Plan
  stripe_customer_id: string | null
  created_at: string
}

const PLAN_META: Record<Plan, { label: string; price: number; locations: number; competitors: number }> = {
  starter: { label: 'Starter', price: 39, locations: 1, competitors: 3 },
  growth:  { label: 'Growth',  price: 99, locations: 5, competitors: 5 },
  agency:  { label: 'Agency',  price: 199, locations: 15, competitors: 10 },
}

const UPGRADE_TIERS: Record<Plan, Plan[]> = {
  starter: ['growth', 'agency'],
  growth:  ['agency'],
  agency:  [],
}

export default async function BillingPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  // plan and stripe_customer_id now live on accounts
  const { data: account } = await admin
    .from('accounts')
    .select('plan, stripe_customer_id, created_at')
    .eq('owner_email', user.email!)
    .single<Account>()

  // Get first restaurant for trial start date + active status
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, active, created_at')
    .eq('owner_email', user.email!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!restaurant) redirect('/onboard')

  // Location and competitor usage counts
  const { count: locationCount } = await admin
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('owner_email', user.email!)

  // Count competitors across all locations for this user
  const { data: restaurantIds } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email!)

  const ids = (restaurantIds ?? []).map(r => r.id)
  const { count: competitorCount } = ids.length > 0
    ? await admin
        .from('competitors')
        .select('id', { count: 'exact', head: true })
        .in('restaurant_id', ids)
        .eq('active', true)
    : { count: 0 }

  const plan = (account?.plan ?? 'starter') as Plan
  const meta = PLAN_META[plan]
  const limits = PLAN_LIMITS[plan]

  const trialStart = new Date(restaurant.created_at)
  const trialEnd = new Date(trialStart)
  trialEnd.setDate(trialEnd.getDate() + 30)
  const now = new Date()
  const inTrial = restaurant.active && !account?.stripe_customer_id && now < trialEnd
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const trialProgress = Math.round(((30 - daysLeft) / 30) * 100)

  // Fetch live renewal date from Stripe
  let renewalDate: Date | null = null
  let trialEndsViaStripe: Date | null = null
  if (account?.stripe_customer_id) {
    try {
      const subs = await getStripe().subscriptions.list({
        customer: account.stripe_customer_id,
        status: 'all',
        limit: 1,
      })
      const sub = subs.data[0]
      if (sub) {
        if (sub.status === 'trialing' && sub.trial_end) {
          trialEndsViaStripe = new Date(sub.trial_end * 1000)
        } else {
          const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
          if (periodEnd) renewalDate = new Date(periodEnd * 1000)
        }
      }
    } catch {
      // non-fatal — just won't show renewal date
    }
  }

  const upgrades = UPGRADE_TIERS[plan]

  const usedLocations = locationCount ?? 0
  const usedCompetitors = competitorCount ?? 0
  const locationPct = Math.round((usedLocations / limits.locations) * 100)
  const competitorPct = Math.round((usedCompetitors / (limits.competitors * Math.max(usedLocations, 1))) * 100)

  return (
    <>
      <div className="sec-head">
        <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>Billing</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>Manage your subscription and payment details</p>
      </div>

      <div className="page-wrap" style={{ maxWidth: 680 }}>

        {/* Trial banner */}
        {inTrial && (
          <div className="banner banner-amber fade-up" style={{ marginBottom: 16 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Free trial · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining — ends{' '}
            {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        {/* Subscription status */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Subscription</h2>
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>
                Replova {meta.label} · ${meta.price} / month
              </p>
            </div>
            {restaurant.active ? (
              <span className="badge badge-green" style={{ padding: '4px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span className="dot dot-green pulse-dot" style={{ width: 6, height: 6 }} />
                Active{inTrial ? ' — Free trial' : ''}
              </span>
            ) : (
              <span className="badge badge-red" style={{ padding: '4px 12px', fontSize: 12 }}>
                Inactive
              </span>
            )}
          </div>

          {/* Trial progress bar */}
          {inTrial && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>Trial progress</span>
                <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>{daysLeft} days left</span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'var(--warn)', width: `${trialProgress}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Day {30 - daysLeft}</span>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Day 30</span>
              </div>
            </div>
          )}

          {!restaurant.active && (
            <div className="banner banner-red" style={{ marginBottom: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Subscription inactive — reactivate below to resume weekly review replies.
            </div>
          )}

          {/* Renewal / trial-end date */}
          {(renewalDate || trialEndsViaStripe) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {trialEndsViaStripe ? (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  Free trial ends — first charge on{' '}
                  <strong style={{ color: 'var(--t1)' }}>
                    {trialEndsViaStripe.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </strong>
                  {' '}at{' '}
                  <strong style={{ color: 'var(--t1)' }}>
                    {trialEndsViaStripe.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                  </strong>
                </span>
              ) : renewalDate ? (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                  Renews on{' '}
                  <strong style={{ color: 'var(--t1)' }}>
                    {renewalDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </strong>
                  {' '}at{' '}
                  <strong style={{ color: 'var(--t1)' }}>
                    {renewalDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                  </strong>
                </span>
              ) : null}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {account?.stripe_customer_id ? (
              <a
                href="/api/billing-portal"
                className="btn-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                  background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                  borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none',
                }}
              >
                Manage subscription
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            ) : restaurant.active ? (
              <>
                <a
                  href="/api/create-checkout"
                  className="btn-press"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                    background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                    borderRadius: 10, fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none',
                  }}
                >
                  Add payment method
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>No charge until {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
              </>
            ) : (
              <a
                href="/api/create-checkout"
                className="btn-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '9px 18px',
                  background: 'var(--t1)', color: 'var(--bg)',
                  borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: 'none',
                }}
              >
                Reactivate subscription
              </a>
            )}
          </div>
        </div>

        {/* Plan details */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '40ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Your plan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 18 }}>
            {(['starter', 'growth', 'agency'] as Plan[]).map((p) => {
              const m = PLAN_META[p]
              const isCurrent = p === plan
              return (
                <div key={p} style={{
                  padding: 14, borderRadius: 12,
                  border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: isCurrent ? 'var(--accent-sub)' : 'var(--surface-0)',
                  position: 'relative',
                }}>
                  {isCurrent && (
                    <span style={{
                      position: 'absolute', top: -9, left: 10,
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    }}>
                      Current
                    </span>
                  )}
                  <p style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? 'var(--accent)' : 'var(--t3)', marginBottom: 4 }}>{m.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--t1)', marginBottom: 6 }}>${m.price}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)' }}>/mo</span></p>
                  <p style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
                    {m.locations === 1 ? '1 location' : `Up to ${m.locations} locations`}<br />
                    {m.competitors} competitor slots
                  </p>
                </div>
              )
            })}
          </div>

          {/* Usage rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
            {/* Locations usage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>Locations</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
                  {usedLocations} of {limits.locations} used
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: locationPct >= 100 ? 'var(--err)' : locationPct >= 80 ? 'var(--warn)' : 'var(--accent)',
                  width: `${Math.min(locationPct, 100)}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>

            {/* Competitor slots usage */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>Competitor slots</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>
                  {usedCompetitors} tracked · {limits.competitors} per location
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: competitorPct >= 100 ? 'var(--err)' : 'var(--accent)',
                  width: `${Math.min(competitorPct, 100)}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          </div>

          {/* Upgrade CTAs — only shown when no active Stripe subscription */}
          {!account?.stripe_customer_id && upgrades.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {upgrades.map((up) => (
                <a
                  key={up}
                  href={`/api/create-checkout?plan=${up}`}
                  className="btn-press"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    background: 'var(--accent)', color: '#fff',
                    borderRadius: 10, fontSize: 12, fontWeight: 600, textDecoration: 'none', border: 'none',
                  }}
                >
                  Upgrade to {PLAN_META[up].label}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* What's included — plan-aware */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '80ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>What&apos;s included on your plan</h2>

          {/* All plans */}
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginBottom: 10 }}>All plans</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { title: 'AI reply drafts', desc: '3 tone variants per review — Professional, Warm, and Brief.' },
              { title: 'Urgent review alerts', desc: 'Instant email when a low-rating review comes in.' },
              { title: 'Weekly digest email', desc: 'Monday morning summary of reviews and AI action items.' },
              { title: 'Auto-detect replied', desc: 'Automatically marks reviews done when you reply on Google.' },
              { title: 'Review request campaigns', desc: 'Email customers asking them to leave a review.' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                  <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Growth+ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)' }}>Growth &amp; Agency</p>
            {plan === 'starter' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-sub)', border: '1px solid oklch(0.62 0.19 258 / 0.25)', borderRadius: 5, padding: '1px 7px' }}>
                Upgrade to unlock
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { title: 'Reputation score', desc: 'Composite 0–100 score tracking your ratings, response rate, and sentiment over time.' },
              { title: 'Sentiment analysis', desc: 'AI reads every review for tone, top keywords, and staff shoutouts.' },
              { title: 'Competitor tracking', desc: `Monitor up to ${plan === 'starter' ? 5 : meta.competitors} nearby restaurants and see how you rank.` },
              { title: 'Monthly PDF report', desc: 'Downloadable report with your key metrics for the month.' },
            ].map(({ title, desc }) => {
              const unlocked = plan === 'growth' || plan === 'agency'
              return (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: unlocked ? 1 : 0.45 }}>
                  {unlocked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  )}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Agency only */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)' }}>Agency only</p>
            {plan !== 'agency' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-sub)', border: '1px solid oklch(0.62 0.19 258 / 0.25)', borderRadius: 5, padding: '1px 7px' }}>
                Upgrade to unlock
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { title: 'Custom reply persona', desc: 'Tell the AI your tone and voice — every draft matches your style.' },
              { title: 'White-label PDF reports', desc: 'Replace the Replova logo with your own for client-ready reports.' },
              { title: 'Up to 15 locations', desc: 'Manage multiple restaurant locations from one account.' },
              { title: '10 competitor slots per location', desc: 'Track a wider competitive set at each location.' },
            ].map(({ title, desc }) => {
              const unlocked = plan === 'agency'
              return (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: unlocked ? 1 : 0.45 }}>
                  {unlocked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                    </svg>
                  )}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Plan pricing */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '120ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Plan pricing</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--t1)' }}>${meta.price}</span>
                <span style={{ fontSize: 14, color: 'var(--t2)', fontWeight: 500 }}>/month</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>Billed monthly · Cancel anytime · No contracts</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['Cancel anytime', 'No setup fees', '30-day free trial'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Help */}
        <div className="card fade-up" style={{ padding: 24, animationDelay: '160ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Need help?</h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
            Questions about billing? Email us at{' '}
            <a href="mailto:support@replova.app" style={{ color: 'var(--accent)', fontWeight: 500 }}>support@replova.app</a>
            {' '}and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

      </div>
    </>
  )
}
