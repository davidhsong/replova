import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { PLAN_LIMITS } from '@/lib/planLimits'
import { IconCheck, IconX, IconExternal } from '@/components/icons'
import type { Plan } from '@/lib/planLimits'
import { getStripe } from '@/lib/stripe'

type Account = {
  plan: Plan
  stripe_customer_id: string | null
  created_at: string
}

const PLAN_META: Record<Plan, {
  label: string
  price: number
  locations: number
  competitors: number
  tagline: string
}> = {
  starter: { label: 'Starter', price: 39,  locations: 1,  competitors: 3,  tagline: 'Single-location businesses' },
  growth:  { label: 'Growth',  price: 99,  locations: 5,  competitors: 5,  tagline: 'Growing multi-location teams' },
  agency:  { label: 'Agency',  price: 199, locations: 15, competitors: 10, tagline: 'Groups and agencies' },
}

const PLAN_FEATURES: Record<Plan, { features: string[]; missing: string[] }> = {
  starter: {
    features: [
      'AI reply drafts (3 variants)',
      'Urgent review alerts',
      'Weekly digest email',
      'Review request campaigns',
    ],
    missing: ['Reputation score', 'Sentiment analysis', 'Competitor tracking', 'Monthly PDF report', 'Custom reply persona'],
  },
  growth: {
    features: [
      'Everything in Starter, plus:',
      'Reputation score (composite)',
      'Sentiment analysis & trend',
      'Competitor tracking',
      'Monthly PDF report',
    ],
    missing: ['Custom reply persona', 'White-label PDF reports'],
  },
  agency: {
    features: [
      'Everything in Growth, plus:',
      'Custom reply persona',
      'White-label PDF reports',
      'Priority support',
    ],
    missing: [],
  },
}

const PLAN_ORDER: Plan[] = ['starter', 'growth', 'agency']

function UsageBar({ used, total, label }: { used: number; total: number | string; label: string }) {
  const totalNum = typeof total === 'number' ? total : Infinity
  const pct = typeof total === 'number' ? Math.min((used / total) * 100, 100) : 10
  const ratio = used / totalNum
  const color = ratio >= 1 ? 'var(--neg)' : ratio >= 0.8 ? 'var(--warn)' : 'var(--pos)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="t-sm c-t2">{label}</span>
        <span className="tnum t-sm" style={{ fontWeight: 600 }}>
          {used} <span className="c-t3">/ {total}</span>
        </span>
      </div>
      <div style={{ height: 5, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

export default async function BillingPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  const { data: account } = await admin
    .from('accounts')
    .select('plan, stripe_customer_id, created_at')
    .eq('owner_email', user.email!)
    .single<Account>()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, active, created_at')
    .eq('owner_email', user.email!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!restaurant) redirect('/onboard')

  const { count: locationCount } = await admin
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .eq('owner_email', user.email!)

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
  const hasStripe = !!account?.stripe_customer_id

  const trialStart = new Date(restaurant.created_at)
  const trialEnd = new Date(trialStart)
  trialEnd.setDate(trialEnd.getDate() + 30)
  const now = new Date()
  const inTrial = restaurant.active && !hasStripe && now < trialEnd
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  let renewalDate: Date | null = null
  let trialEndsViaStripe: Date | null = null
  let stripeTrialDaysLeft: number | null = null
  let inStripeTrialByDate = false

  if (hasStripe) {
    try {
      const subs = await getStripe().subscriptions.list({
        customer: account!.stripe_customer_id!,
        status: 'all',
        limit: 1,
      })
      const sub = subs.data[0]
      if (sub) {
        if (sub.status === 'trialing' && sub.trial_end) {
          trialEndsViaStripe = new Date(sub.trial_end * 1000)
          stripeTrialDaysLeft = Math.max(0, Math.ceil((trialEndsViaStripe.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          inStripeTrialByDate = now < trialEndsViaStripe
        } else {
          const periodEnd = sub.items.data[0]?.current_period_end
          if (periodEnd) renewalDate = new Date(periodEnd * 1000)
        }
      }
    } catch {
      // non-fatal
    }
  }

  const showingTrial = inTrial || inStripeTrialByDate
  const effectiveDaysLeft = inStripeTrialByDate ? (stripeTrialDaysLeft ?? daysLeft) : daysLeft
  const effectiveTrialEnd = inStripeTrialByDate ? (trialEndsViaStripe ?? trialEnd) : trialEnd
  const effectiveTrialProgress = Math.round(((30 - effectiveDaysLeft) / 30) * 100)

  const usedLocations = locationCount ?? 0
  const usedCompetitors = competitorCount ?? 0

  return (
    <>
      <div className="page-header" style={{ maxWidth: 1040 }}>
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--t3)' }}>Workspace</span>
          {' › '}
          <span>Billing</span>
        </div>
        <h1 className="t-h1" style={{ marginBottom: 4 }}>Billing</h1>
        <p className="t-sm c-t3">{restaurant.name}</p>
      </div>

      <div className="page-body" style={{ maxWidth: 1040 }}>

        {/* Two-column status card */}
        <div className="card fade-up" style={{
          padding: 28, marginBottom: 32,
          display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 32,
        }}>
          {/* Left: plan info */}
          <div>
            <div className="t-eyebrow" style={{ marginBottom: 8 }}>Current plan</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <h2 className="t-serif" style={{ fontSize: 36, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {meta.label}
              </h2>
              {restaurant.active ? (
                showingTrial
                  ? <span className="pill pill-accent">Free trial</span>
                  : <span className="pill pill-pos">Active</span>
              ) : (
                <span className="pill pill-neg">Inactive</span>
              )}
            </div>
            <div className="t-sm c-t2" style={{ marginBottom: 24 }}>
              <span className="tnum" style={{ fontWeight: 600, color: 'var(--t1)' }}>${meta.price}</span> / month
              {renewalDate && (
                <span className="c-t3">
                  {' · '}renews {renewalDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>

            {showingTrial && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span className="t-eyebrow">Trial · day {30 - effectiveDaysLeft} of 30</span>
                  <span className="t-xs c-t3">
                    <strong style={{ color: effectiveDaysLeft <= 7 ? 'var(--warn)' : 'var(--t1)' }} className="tnum">
                      {effectiveDaysLeft} days
                    </strong> remaining
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${effectiveTrialProgress}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.4s' }} />
                </div>
                <div className="t-xs c-t3" style={{ marginTop: 6 }}>
                  First charge: <strong style={{ color: 'var(--t1)' }}>
                    {effectiveTrialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </strong>. Cancel any time before then, no charge.
                </div>
              </div>
            )}

            {!restaurant.active && (
              <div className="banner banner-neg" style={{ marginBottom: 20 }}>
                Subscription inactive. Reactivate below to resume review management.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {!restaurant.active ? (
                <a href="/api/create-checkout" className="btn btn-primary">
                  Reactivate subscription
                </a>
              ) : hasStripe ? (
                <a href="/api/billing-portal" className="btn btn-primary btn-sm">
                  Manage subscription <IconExternal s={11} />
                </a>
              ) : restaurant.active ? (
                <>
                  <a href="/api/create-checkout" className="btn btn-primary btn-sm">
                    Add payment method <IconExternal s={11} />
                  </a>
                  <span className="t-xs c-t3">
                    No charge until {effectiveTrialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {/* Right: usage */}
          <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="t-eyebrow">Usage this month</div>
            <UsageBar used={usedLocations} total={limits.locations} label="Locations" />
            <UsageBar
              used={usedCompetitors}
              total={limits.competitors * Math.max(usedLocations, 1)}
              label="Competitor slots"
            />
          </div>
        </div>

        {/* Plan ladder */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Change plan</h3>
          <span className="t-xs c-t3">Stripe will prorate any change</span>
        </div>

        <div style={{ border: '1px solid var(--line-md)', borderRadius: 'var(--r-6)', overflow: 'hidden', marginBottom: 32 }}>
          {PLAN_ORDER.map((p, i) => {
            const m = PLAN_META[p]
            const f = PLAN_FEATURES[p]
            const isCurrent = p === plan
            const isUpgrade = PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(plan)

            return (
              <div key={p} style={{
                display: 'grid', gridTemplateColumns: '200px 1fr 240px', gap: 32,
                padding: '28px 32px',
                borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                background: isCurrent ? 'var(--surface)' : 'transparent',
                alignItems: 'flex-start',
              }}>
                {/* Plan name + price */}
                <div>
                  <div className="t-eyebrow" style={{ color: isCurrent ? 'var(--accent)' : 'var(--t3)', marginBottom: 8 }}>
                    {m.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span className="t-serif" style={{ fontSize: 36, lineHeight: 1 }}>${m.price}</span>
                    <span className="t-xs c-t3">/ mo</span>
                  </div>
                  <div className="t-xs c-t3">
                    {m.locations === 1 ? '1 location' : `Up to ${m.locations} locations`} · {m.competitors} competitor slots
                  </div>
                  <div className="t-xs" style={{ color: 'var(--t2)', marginTop: 10, fontStyle: 'italic' }}>For: {m.tagline}</div>
                  {isCurrent && (
                    <span className="pill pill-accent" style={{ marginTop: 14, display: 'inline-flex' }}>
                      <IconCheck s={10} sw={2.6} /> Current plan
                    </span>
                  )}
                </div>

                {/* Feature list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13, lineHeight: 1.55, paddingTop: 4 }}>
                  {f.features.map((feat, fi) => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: fi === 0 && feat.startsWith('Everything') ? 'var(--t3)' : 'var(--t2)' }}>
                      <span style={{ color: 'var(--accent)', marginTop: 1, flexShrink: 0 }}>
                        <IconCheck s={11} sw={2.4} />
                      </span>
                      <span>{feat}</span>
                    </div>
                  ))}
                  {f.missing.map(feat => (
                    <div key={feat} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--t4)' }}>
                      <span style={{ marginTop: 1, flexShrink: 0 }}><IconX s={10} sw={1.6} /></span>
                      <span style={{ textDecoration: 'line-through', textDecorationColor: 'var(--line-md)' }}>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifySelf: 'end', alignItems: 'flex-end', paddingTop: 4 }}>
                  {isCurrent ? (
                    <button className="btn btn-ghost" style={{ width: 200 }} disabled>
                      You&apos;re on this plan
                    </button>
                  ) : hasStripe ? (
                    <a
                      href="/api/billing-portal"
                      className={`btn ${isUpgrade ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ width: 200, justifyContent: 'center', textDecoration: 'none' }}
                    >
                      {isUpgrade ? `Upgrade to ${m.label}` : `Downgrade to ${m.label}`}
                    </a>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <a
                        href={`/api/create-checkout?plan=${p}`}
                        className={`btn ${isUpgrade ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ width: 200, justifyContent: 'center', textDecoration: 'none' }}
                      >
                        {isUpgrade ? `Upgrade to ${m.label}` : `Downgrade to ${m.label}`}
                      </a>
                      <span className="t-xs c-t3">
                        {isUpgrade
                          ? `+$${m.price - meta.price}/mo · prorated`
                          : `Save $${meta.price - m.price}/mo`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Help row */}
        <div style={{
          padding: '18px 22px', background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Not sure which plan fits?</div>
            <div className="t-xs c-t3">Email support and tell us how many locations you manage.</div>
          </div>
          <a href="mailto:support@replova.app" className="btn btn-ghost btn-sm">
            support@replova.app <IconExternal s={11} />
          </a>
        </div>

      </div>
    </>
  )
}
