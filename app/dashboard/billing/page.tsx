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

const PLAN_META: Record<Plan, {
  label: string
  price: number
  locations: number
  competitors: number
  tagline: string
}> = {
  starter: { label: 'Starter', price: 39,  locations: 1,  competitors: 3,  tagline: 'Perfect for a single location' },
  growth:  { label: 'Growth',  price: 99,  locations: 5,  competitors: 5,  tagline: 'Great for growing restaurants' },
  agency:  { label: 'Agency',  price: 199, locations: 15, competitors: 10, tagline: 'Built for multi-location operators' },
}

const PLAN_ORDER: Plan[] = ['starter', 'growth', 'agency']

function CheckIcon({ color = 'var(--ok)' }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
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
  const trialProgress = Math.round(((30 - daysLeft) / 30) * 100)

  let renewalDate: Date | null = null
  let trialEndsViaStripe: Date | null = null
  let stripeTrialDaysLeft: number | null = null
  let inStripeTrialByDate: boolean = false

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
          const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end
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
  const locationPct = Math.round((usedLocations / limits.locations) * 100)
  const competitorPct = Math.round((usedCompetitors / (limits.competitors * Math.max(usedLocations, 1))) * 100)

  return (
    <>
      <div className="sec-head">
        <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>Billing</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>Manage your plan and payment details</p>
      </div>

      <div className="page-wrap" style={{ maxWidth: 700 }}>

        {/* ── Status card ─────────────────────────────── */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: showingTrial ? 20 : 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)' }}>
                  Replova {meta.label}
                </h2>
                {restaurant.active ? (
                  <span className="badge badge-green" style={{ padding: '3px 10px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span className="dot dot-green pulse-dot" style={{ width: 5, height: 5 }} />
                    {showingTrial ? 'Free trial' : 'Active'}
                  </span>
                ) : (
                  <span className="badge badge-red" style={{ padding: '3px 10px', fontSize: 11 }}>Inactive</span>
                )}
              </div>
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>
                {showingTrial
                  ? `$${meta.price}/mo · free until ${effectiveTrialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : renewalDate
                    ? `$${meta.price}/mo · renews ${renewalDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                    : `$${meta.price}/mo · billed monthly`
                }
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {hasStripe ? (
                <a
                  href="/api/billing-portal"
                  className="btn-press"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                    borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none',
                  }}
                >
                  Manage subscription
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </a>
              ) : restaurant.active ? (
                <>
                  <a
                    href="/api/create-checkout"
                    className="btn-press"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                      background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                      borderRadius: 10, fontSize: 12, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none',
                    }}
                  >
                    Add payment method
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--t3)' }}>No charge until {effectiveTrialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
                </>
              ) : (
                <a
                  href="/api/create-checkout"
                  className="btn-press"
                  style={{
                    display: 'inline-flex', alignItems: 'center', padding: '8px 16px',
                    background: 'var(--t1)', color: 'var(--bg)',
                    borderRadius: 999, fontSize: 13, fontWeight: 700, textDecoration: 'none', border: 'none',
                  }}
                >
                  Reactivate subscription
                </a>
              )}
            </div>
          </div>

          {/* Trial progress */}
          {showingTrial && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>Free trial</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: effectiveDaysLeft <= 7 ? 'var(--warn)' : 'var(--t2)' }}>
                  {effectiveDaysLeft} day{effectiveDaysLeft !== 1 ? 's' : ''} remaining
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, background: 'var(--warn)', width: `${effectiveTrialProgress}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Day {30 - effectiveDaysLeft}</span>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Day 30 · first charge</span>
              </div>
            </div>
          )}

          {!restaurant.active && (
            <div className="banner banner-red" style={{ marginTop: showingTrial ? 16 : 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Subscription inactive. Reactivate above to resume review management.
            </div>
          )}
        </div>

        {/* ── Plan selection ───────────────────────────── */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '40ms' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Choose your plan</h2>
            {hasStripe && (
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                Plan changes take effect immediately via Stripe
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            {PLAN_ORDER.map((p) => {
              const m = PLAN_META[p]
              const isCurrent = p === plan
              const isUpgrade = PLAN_ORDER.indexOf(p) > PLAN_ORDER.indexOf(plan)
              const isDowngrade = PLAN_ORDER.indexOf(p) < PLAN_ORDER.indexOf(plan)

              // CTA href
              let href = hasStripe
                ? '/api/billing-portal'
                : `/api/create-checkout?plan=${p}`

              return (
                <div key={p} style={{
                  padding: '16px 14px 14px',
                  borderRadius: 14,
                  border: isCurrent ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: isCurrent ? 'var(--accent-sub)' : 'var(--surface-0)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}>
                  {isCurrent && (
                    <span style={{
                      position: 'absolute', top: -9, left: 12,
                      background: 'var(--accent)', color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    }}>
                      Current plan
                    </span>
                  )}

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? 'var(--accent)' : 'var(--t3)', marginBottom: 3 }}>{m.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--t1)', lineHeight: 1 }}>
                      ${m.price}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)' }}>/mo</span>
                    </p>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
                    <div>{m.locations === 1 ? '1 location' : `Up to ${m.locations} locations`}</div>
                    <div>{m.competitors} competitor slots / location</div>
                  </div>

                  {isCurrent ? (
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', paddingTop: 2 }}>
                      ✓ Your plan
                    </div>
                  ) : isUpgrade ? (
                    <a
                      href={href}
                      className="btn-press"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '7px 10px',
                        background: 'var(--accent)', color: '#fff',
                        borderRadius: 8, fontSize: 11, fontWeight: 700, textDecoration: 'none', border: 'none',
                        marginTop: 'auto',
                      }}
                    >
                      Upgrade
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                      </svg>
                    </a>
                  ) : (
                    <a
                      href={hasStripe ? '/api/billing-portal' : href}
                      className="btn-press"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        padding: '7px 10px',
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, color: 'var(--t2)', textDecoration: 'none',
                        marginTop: 'auto',
                      }}
                    >
                      Downgrade
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          {hasStripe && (
            <p style={{ fontSize: 11, color: 'var(--t3)', lineHeight: 1.5 }}>
              Upgrades and downgrades are processed through the Stripe billing portal. Proration is handled automatically.
            </p>
          )}
        </div>

        {/* ── Usage ────────────────────────────────────── */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '80ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 16 }}>Plan usage</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>Locations</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: locationPct >= 100 ? 'var(--err)' : 'var(--t1)' }}>
                  {usedLocations} / {limits.locations}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: locationPct >= 100 ? 'var(--err)' : locationPct >= 80 ? 'var(--warn)' : 'var(--accent)',
                  width: `${Math.min(locationPct, 100)}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>Competitors tracked</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                  {usedCompetitors} · {limits.competitors} slots / location
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  background: competitorPct >= 100 ? 'var(--err)' : 'var(--accent)',
                  width: `${Math.min(competitorPct, 100)}%`, transition: 'width 0.3s',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── What's included ──────────────────────────── */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '120ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>What&apos;s included</h2>

          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginBottom: 10 }}>All plans</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { title: 'AI reply drafts', desc: '3 tone variants per review — Professional, Warm, and Brief.' },
              { title: 'Urgent review alerts', desc: 'Instant email when a low-rating review comes in.' },
              { title: 'Weekly digest email', desc: 'Monday summary of reviews and AI action items.' },
              { title: 'Review request campaigns', desc: 'Email customers asking them to leave a review.' },
            ].map(({ title, desc }) => (
              <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <CheckIcon />
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                  <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                </div>
              </div>
            ))}
          </div>

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
              { title: 'Reputation score', desc: 'Composite 0–100 score tracking ratings, response rate, and sentiment.' },
              { title: 'Sentiment analysis', desc: 'AI reads every review for tone, keywords, and staff shoutouts.' },
              { title: 'Competitor tracking', desc: `Monitor nearby restaurants and see how you rank.` },
              { title: 'Monthly PDF report', desc: 'Downloadable report with key metrics for the month.' },
            ].map(({ title, desc }) => {
              const unlocked = plan === 'growth' || plan === 'agency'
              return (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: unlocked ? 1 : 0.4 }}>
                  {unlocked ? <CheckIcon /> : <LockIcon />}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              )
            })}
          </div>

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
              { title: 'Custom reply persona', desc: 'Set your tone and voice — every AI draft matches your style.' },
              { title: 'White-label PDF reports', desc: 'Replace the Replova logo with your own for client-ready reports.' },
              { title: 'Up to 15 locations', desc: 'Manage multiple locations from one account.' },
            ].map(({ title, desc }) => {
              const unlocked = plan === 'agency'
              return (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, opacity: unlocked ? 1 : 0.4 }}>
                  {unlocked ? <CheckIcon /> : <LockIcon />}
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{title}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Help ─────────────────────────────────────── */}
        <div className="card fade-up" style={{ padding: 24, animationDelay: '160ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Need help?</h2>
          <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.65 }}>
            Questions about billing or plans? Email{' '}
            <a href="mailto:support@replova.app" style={{ color: 'var(--accent)', fontWeight: 500 }}>support@replova.app</a>
            {' '}and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

      </div>
    </>
  )
}
