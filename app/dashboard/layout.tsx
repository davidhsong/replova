import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'
import { isCareerAdminEmail } from '@/lib/careersAdmin'
import { isDeveloperEmail } from '@/lib/developerAccess'
import DashboardSidebar from './DashboardSidebar'
import TermsModal from './TermsModal'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { IconCog, IconSend } from '@/components/icons'

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

  // Fetch both the account and workspaces before deciding which dashboard
  // surface this authenticated user may access.
  const [{ data: restaurants }, { data: account }] = await Promise.all([
    admin
      .from('restaurants')
      .select('id, name, active, created_at')
      .eq('owner_email', user.email)
      .order('created_at', { ascending: true }),
    admin
      .from('accounts')
      .select('plan, terms_accepted_at')
      .eq('owner_email', user.email!)
      .maybeSingle(),
  ])

  if (!restaurants || restaurants.length === 0) {
    const isVerifiedDeveloper = Boolean(
      account && user.email_confirmed_at && isDeveloperEmail(user.email)
    )

    // Restaurant-free developer access is deliberately limited to YouTube
    // Settings and the persistent Reply Queue. All business routes remain gated.
    if (!isVerifiedDeveloper) redirect('/onboard')
    const developerRoutes = new Set(['/dashboard/settings', '/dashboard/youtube/replies'])
    if (!developerRoutes.has(pathname)) redirect('/dashboard/settings')

    return (
      <div className="app">
        <header className="mobile-app-header">
          <Link href="/dashboard/settings" className="mobile-app-brand" aria-label="Replova settings">
            <ReplovaLogo variant="primary" surface="light" height={21} decorative eager />
          </Link>
          <div className="mobile-app-context">
            <span>Developer workspace</span>
            <small>Integrations</small>
          </div>
        </header>
        <main id="main-content" className="main">{children}</main>
        <nav className="mobile-nav mobile-nav-developer" aria-label="Developer workspace navigation">
          <Link href="/dashboard/youtube/replies" className={pathname === '/dashboard/youtube/replies' ? 'active' : ''} aria-current={pathname === '/dashboard/youtube/replies' ? 'page' : undefined}>
            <IconSend s={18} />
            <span>YouTube</span>
          </Link>
          <Link href="/dashboard/settings" className={pathname === '/dashboard/settings' ? 'active' : ''} aria-current={pathname === '/dashboard/settings' ? 'page' : undefined}>
            <IconCog s={18} />
            <span>Settings</span>
          </Link>
        </nav>
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
