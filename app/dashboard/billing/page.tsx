import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Restaurant = {
  id: string
  name: string
  active: boolean
  stripe_customer_id: string | null
  created_at: string
}

export default async function BillingPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, active, stripe_customer_id, created_at')
    .eq('owner_email', user.email)
    .single<Restaurant>()

  if (!restaurant) redirect('/onboard')

  const trialStart = new Date(restaurant.created_at)
  const trialEnd = new Date(trialStart)
  trialEnd.setDate(trialEnd.getDate() + 30)
  const now = new Date()
  const inTrial = restaurant.active && !restaurant.stripe_customer_id && now < trialEnd
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const trialProgress = Math.round(((30 - daysLeft) / 30) * 100)

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
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>Replova Monthly · $99 / month</p>
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

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {restaurant.stripe_customer_id ? (
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

        {/* What's included */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '40ms' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 18 }}>What&apos;s included</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                ),
                color: 'var(--accent)',
                bg: 'var(--accent-sub)',
                title: 'AI reply drafts',
                desc: '3 tone options per review: Professional, Warm, Brief.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                ),
                color: 'var(--err)',
                bg: 'var(--err-sub)',
                title: 'Urgent alerts',
                desc: 'Low-rating reviews flagged instantly with email alerts.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                ),
                color: 'var(--warn)',
                bg: 'var(--warn-sub)',
                title: 'Weekly digest',
                desc: 'Monday morning summary of reviews and action items.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ),
                color: 'var(--ok)',
                bg: 'var(--ok-sub)',
                title: 'Auto-detect replied',
                desc: 'Marks reviews complete when you reply on Google.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                ),
                color: 'var(--accent)',
                bg: 'var(--accent-sub)',
                title: 'Competitor tracking',
                desc: 'Monitor up to 3 nearby restaurants\' ratings.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
                color: 'var(--ok)',
                bg: 'var(--ok-sub)',
                title: 'Saves 5+ hrs/week',
                desc: 'Stop copy-pasting replies — AI handles the heavy lifting.',
              },
            ].map(({ icon, color, bg, title, desc }) => (
              <div key={title} style={{
                display: 'flex', gap: 12, padding: 14,
                background: 'var(--surface-0)', borderRadius: 12, border: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 32, height: 32, background: bg, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  color, border: `1px solid ${color}22`,
                }}>
                  {icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.55 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Plan pricing */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: '80ms' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>Plan pricing</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--t1)' }}>$99</span>
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
        <div className="card fade-up" style={{ padding: 24, animationDelay: '120ms' }}>
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
