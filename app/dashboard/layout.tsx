import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'
import { isCareerAdminEmail } from '@/lib/careersAdmin'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import DashboardSidebar from './DashboardSidebar'
import TermsModal from './TermsModal'

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false, nocache: true },
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const requestHeaders = await headers()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')
  const isCareersAdmin = await isCareerAdminEmail(user.email)
  const pathname = requestHeaders.get('x-replova-pathname') ?? '/dashboard'

  const admin = getSupabaseAdmin()

  const account = await getAccountForAuthUser(admin, user)
  if (!account) redirect('/onboard/workspace')

  const [{ data: workspaces }, { data: restaurants }] = await Promise.all([
    admin
      .from('business_workspaces')
      .select('id, name, status, created_at')
      .eq('account_id', account.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true }),
    admin
      .from('restaurants')
      .select('id, name, active, created_at')
      .eq('owner_email', account.owner_email)
      .order('created_at', { ascending: true }),
  ])

  const workspace = workspaces?.[0]
  if (!workspace) redirect('/onboard/workspace')

  const plan: Plan = account.plan
  const limits = getPlanLimits(plan)
  const needsTermsAcceptance = !account.terms_accepted_at

  if (!restaurants || restaurants.length === 0) {
    const accountOnlyRoutes = new Set([
      '/dashboard',
      '/dashboard/billing',
      '/dashboard/settings',
      '/dashboard/youtube/replies',
      ...(isCareersAdmin ? ['/dashboard/applicants'] : []),
    ])
    if (!accountOnlyRoutes.has(pathname)) redirect('/dashboard')

    const trialEnd = new Date(new Date(account.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    const trialEndDate = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    const displayName = (user.user_metadata?.display_name as string | undefined) ?? ''
    const avatarUrl = user.user_metadata?.avatar_url as string | undefined
    const initials = (displayName || (user.email ?? ''))
      .split(/[\s@]/)
      .filter(Boolean)
      .map((part: string) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'

    return (
      <div className="app">
        <DashboardSidebar
          restaurantName={workspace.name}
          plan={plan}
          displayName={displayName}
          initials={initials}
          avatarUrl={avatarUrl}
          userEmail={user.email!}
          locations={[]}
          activeLocationId={null}
          locationLimit={limits.locations}
          awaitingCount={0}
          isCareersAdmin={isCareersAdmin}
        />
        <main id="main-content" className="main">{children}</main>
        {needsTermsAcceptance && <TermsModal plan={plan} trialEndDate={trialEndDate} />}
      </div>
    )
  }

  // Prefer the selected location when it is enabled. After a downgrade, an
  // old cookie may point at a location outside the new plan limit.
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  const activeRestaurant = restaurants.find(r => r.id === activeId && r.active)
    ?? restaurants.find(r => r.active)
    ?? restaurants[0]

  // Gate inactive workspaces while leaving Billing reachable for reactivation.
  if (!activeRestaurant.active && pathname !== '/dashboard/billing') {
    const plans = [
      {
        key: 'starter', label: 'Starter', price: '$39', sub: '1 location',
        features: ['1 location', 'AI reply drafts', 'Urgent review alerts', 'Weekly digest'],
        primary: false,
      },
      {
        key: 'growth', label: 'Growth', price: '$99', sub: 'Up to 5 locations',
        features: ['Up to 5 locations', '5 competitor slots', 'AI reply drafts', 'Sentiment & scoring', 'Priority monitoring'],
        primary: true,
      },
      {
        key: 'agency', label: 'Agency', price: '$199', sub: 'Up to 15 locations',
        features: ['Up to 15 locations', '10 competitor slots', 'AI reply drafts', 'Custom persona', 'Multi-location oversight'],
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
        <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 480 }}>
            <div className="t-eyebrow" style={{ marginBottom: 12 }}>Start your free trial</div>
            <h1 className="t-serif" style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 14 }}>Choose your plan</h1>
            <p style={{ fontSize: 15, color: 'var(--t3)', lineHeight: 1.6 }}>30 days free. No charge until your trial ends. Cancel anytime.</p>
          </div>
          <div className="inactive-plan-grid" style={{ width: '100%', maxWidth: 860 }}>
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

  // Trial end date: 30 days from first restaurant creation
  const { data: firstRestaurant } = await admin
    .from('restaurants')
    .select('created_at')
    .eq('owner_email', account.owner_email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const trialStart = firstRestaurant?.created_at ?? activeRestaurant.created_at
  const trialEnd = new Date(new Date(trialStart).getTime() + 30 * 24 * 60 * 60 * 1000)
  const trialEndDate = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const { count: awaitingCount } = await admin
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', activeRestaurant.id)
    .neq('status', 'replied')

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
        awaitingCount={awaitingCount ?? 0}
        isCareersAdmin={isCareersAdmin}
      />
      <main id="main-content" className="main">{children}</main>
      {needsTermsAcceptance && (
        <TermsModal plan={plan} trialEndDate={trialEndDate} />
      )}
    </div>
  )
}
