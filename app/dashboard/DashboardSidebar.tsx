'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  IconAlert,
  IconBriefcase,
  IconCard,
  IconCog,
  IconMessage,
  IconSend,
  IconSignOut,
  IconUpload,
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

const OPERATIONS_ITEMS = [
  {
    href: '/dashboard/feedback-demo',
    label: 'Feedback demo',
    Icon: IconAlert,
    exact: false,
    requiresLocation: false,
  },
  {
    href: '/dashboard',
    label: 'Review center',
    Icon: IconMessage,
    exact: true,
    requiresLocation: false,
    showsBadge: true,
  },
  {
    href: '/dashboard/competitors',
    label: 'Competitors',
    Icon: IconUsers,
    exact: false,
    requiresLocation: true,
  },
  {
    href: '/dashboard/review-requests',
    label: 'Review requests',
    Icon: IconUpload,
    exact: false,
    requiresLocation: true,
  },
]

const INTEGRATION_ITEMS = [
  {
    href: '/dashboard/youtube',
    label: 'YouTube Studio',
    Icon: IconSend,
    exact: false,
    requiresLocation: false,
  },
]

const ACCOUNT_ITEMS = [
  { href: '/dashboard/billing', label: 'Billing', Icon: IconCard },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconCog },
]

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
  awaitingCount,
  isCareersAdmin,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const hasLocations = locations.length > 0
  const operationsItems = OPERATIONS_ITEMS.filter(item => hasLocations || !item.requiresLocation)

  function active(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/signin')
  }

  function renderGroup(
    label: string,
    items: Array<{
      href: string
      label: string
      Icon: typeof IconMessage
      exact?: boolean
      showsBadge?: boolean
    }>,
  ) {
    return (
      <section className={styles.navGroup} aria-label={label}>
        <span className={styles.navLabel}>{label}</span>
        <div className={styles.navList}>
          {items.map(({ href, label: itemLabel, Icon, exact, showsBadge }) => {
            const isActive = active(href, exact)
            const badge = showsBadge && awaitingCount > 0 ? awaitingCount : null
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className={styles.navIcon} aria-hidden="true"><Icon s={15} /></span>
                <span>{itemLabel}</span>
                {badge !== null ? <span className={styles.navCounter}>{badge}</span> : null}
              </Link>
            )
          })}
        </div>
      </section>
    )
  }

  const adminItems = isCareersAdmin
    ? [{ href: '/dashboard/applicants', label: 'Applicants', Icon: IconBriefcase }]
    : []

  return (
    <aside className={`sidebar ${styles.sidebar}`}>
      <Link href="/dashboard" className={styles.brand} aria-label="Replova dashboard">
        <ReplovaLogo variant="primary" surface="light" height={23} decorative eager />
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

        {locations.length > 1 ? (
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

      <nav className={styles.navigation} aria-label="Dashboard">
        {renderGroup('Operations', operationsItems)}
        {renderGroup('Integrations', INTEGRATION_ITEMS)}
        {renderGroup('Account', ACCOUNT_ITEMS)}
        {adminItems.length > 0 ? renderGroup('Administration', adminItems) : null}
      </nav>

      <footer className={styles.userFooter}>
        {avatarUrl ? (
          // User avatars can be hosted on arbitrary OAuth provider domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={`${displayName || userEmail} profile`}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarFallback} aria-hidden="true">{initials}</div>
        )}
        <div className={styles.userCopy}>
          <strong>{displayName || restaurantName}</strong>
          <span>{userEmail}</span>
        </div>
        <button type="button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">
          <IconSignOut s={15} />
        </button>
      </footer>
    </aside>
  )
}
