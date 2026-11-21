'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  IconBook,
  IconCard,
  IconCog,
  IconMessage,
  IconSend,
  IconSignOut,
  IconUsers,
} from '@/components/icons'
import LocationSwitcherClient from '@/components/dashboard/LocationSwitcherClient'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { getSupabaseBrowser } from '@/lib/supabase'
import type { Plan } from '@/lib/planLimits'
import styles from './DashboardSidebar.module.css'

type Location = { id: string; name: string; active: boolean }

interface Props {
  restaurantName: string
  plan: Plan
  displayName: string
  initials: string
  avatarUrl?: string
  userEmail: string
  locations: Location[]
  activeLocationId: string | null
  locationLimit: number
  awaitingCount: number
  isCareersAdmin: boolean
}

const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
}
function Chevron({ down = false }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={down ? styles.chevronDown : undefined}>
      <path d="m5.5 3.5 4.5 4.5-4.5 4.5" />
    </svg>
  )
}

export default function DashboardSidebar({
  restaurantName,
  plan,
  displayName,
  initials,
  avatarUrl,
  userEmail,
  locations,
  activeLocationId,
  locationLimit,
  isCareersAdmin,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  useEffect(() => {
    const update = (event: Event) =>
      setPendingReviewCount(Number((event as CustomEvent).detail?.count) || 0)
    window.addEventListener('replova:playbook-review-count', update)
    return () => window.removeEventListener('replova:playbook-review-count', update)
  }, [])
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const navItems = [
    { href: '/dashboard', label: 'Overview', Icon: IconUsers },
    { href: '/dashboard/feedback', label: 'Feedback', Icon: IconMessage },
    { href: '/dashboard/playbooks', label: 'Playbooks', Icon: IconBook },
    { href: '/dashboard/tap', label: 'Tap', Icon: IconSend },
  ]
  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/signin')
  }

  return (
    <aside className={`sidebar ${styles.sidebar}`}>
      <Link href="/dashboard" className={styles.brand} aria-label="Replova dashboard">
        <ReplovaLogo
          className={styles.brandFull}
          variant="primary"
          surface="light"
          height={22}
          decorative
          eager
        />
        <ReplovaLogo
          className={styles.brandIcon}
          variant="icon"
          surface="light"
          height={22}
          decorative
          eager
        />
      </Link>

      <div className={styles.workspaceCard}>
        <div className={styles.workspaceRow}>
          <div className={styles.workspaceSymbol} aria-hidden="true">
            {restaurantName.slice(0, 1).toUpperCase()}
          </div>
          <div className={styles.workspaceCopy}>
            <strong>{restaurantName}</strong>
            <span>
              {locations.length} location{locations.length !== 1 ? 's' : ''}
              <i aria-hidden="true" />
              {PLAN_LABELS[plan]}
            </span>
          </div>
        </div>
        {locations.length > 1 || (locations.length === 1 && locationLimit > 1) ? (
          <div className={styles.locationSwitcher}>
            <LocationSwitcherClient
              locations={locations}
              activeLocationId={activeLocationId ?? locations[0].id}
              locationLimit={locationLimit}
              currentCount={locations.length}
            />
          </div>
        ) : null}
      </div>

      <nav className={styles.navigation} aria-label="Workspace navigation">
        <div className={styles.navList}>
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (pathname.startsWith(item.href + '/') && item.href !== '/dashboard')
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              >
                <item.Icon s={18} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
        <details className="secondary-tools">
          <summary>More tools</summary>
          <Link href="/dashboard/playbook">Procedure library</Link>
          <Link href="/dashboard/playbook?view=review">
            Needs action {pendingReviewCount || ''}
          </Link>
          <Link href="/dashboard/playbook?view=tasks">Team tasks</Link>
          <Link href="/dashboard/reviews">Review center</Link>
          {locations.length > 0 && (
            <>
              <Link href="/dashboard/competitors">Competitors</Link>
              <Link href="/dashboard/review-requests">Review requests</Link>
            </>
          )}
          <Link href="/dashboard/feedback-demo">Feedback demo</Link>
          <Link href="/dashboard/youtube">YouTube Studio</Link>
          <Link href="/dashboard/settings?section=google-business">Integrations</Link>
          {isCareersAdmin && <Link href="/dashboard/applicants">Applicants</Link>}
        </details>
      </nav>

      <div className={styles.accountArea} ref={accountMenuRef}>
        {accountMenuOpen ? (
          <div className={styles.accountMenu} role="menu">
            <Link href="/dashboard/billing" role="menuitem">
              <IconCard s={15} />
              <span>Billing</span>
            </Link>
            <Link href="/dashboard/settings" role="menuitem">
              <IconCog s={15} />
              <span>Settings</span>
            </Link>
            <button type="button" role="menuitem" onClick={handleSignOut}>
              <IconSignOut s={15} />
              <span>Sign out</span>
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={styles.userFooter}
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          onClick={() => setAccountMenuOpen((open) => !open)}
        >
          {avatarUrl ? (
            // User avatars can be hosted on arbitrary OAuth provider domains.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {initials}
            </span>
          )}
          <span className={styles.userCopy}>
            <strong>{displayName || restaurantName}</strong>
            <small>{userEmail}</small>
          </span>
          <Chevron down={accountMenuOpen} />
        </button>
      </div>
    </aside>
  )
}
