'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  IconAlert,
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
type Feature = 'feedback' | 'playbook' | 'integrations'

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
const FEATURES: Array<{
  id: Feature
  label: string
  href: string
  description: string
}> = [
  {
    id: 'feedback',
    label: 'Customer Feedback',
    href: '/dashboard',
    description: 'Reviews and insights',
  },
  {
    id: 'playbook',
    label: 'Business Playbook',
    href: '/dashboard/playbook/demo',
    description: 'Procedures and tasks',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/dashboard/settings?section=google-business',
    description: 'Connected services',
  },
]

// Compatibility routes remain available even though the simplified switcher now names
// their destinations Reviews, Insights, and Try sample data: Review center, Competitors,
// Feedback demo, and Review requests (/dashboard/review-requests).

function Chevron({ down = false }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={down ? styles.chevronDown : undefined}
    >
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
  awaitingCount,
}: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const featureMenuRef = useRef<HTMLDivElement>(null)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const [featureMenuOpen, setFeatureMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const hasLocations = locations.length > 0

  const activeFeature: Feature = pathname.startsWith('/dashboard/playbook')
    ? 'playbook'
    : pathname.startsWith('/dashboard/youtube') ||
        pathname.startsWith('/dashboard/settings')
      ? 'integrations'
      : 'feedback'
  const feature =
    FEATURES.find((item) => item.id === activeFeature) ?? FEATURES[0]
  const FeatureIcon =
    activeFeature === 'playbook'
      ? IconBook
      : activeFeature === 'integrations'
        ? IconCog
        : IconMessage
  const playbookBase = pathname.startsWith('/dashboard/playbook/demo')
    ? '/dashboard/playbook/demo'
    : '/dashboard/playbook'
  const playbookView = searchParams.get('view') ?? 'procedures'

  const navItems =
    activeFeature === 'feedback'
      ? [
          {
            href: '/dashboard',
            label: 'Reviews',
            Icon: IconMessage,
            exact: true,
            badge: awaitingCount || null,
          },
          {
            href: '/dashboard/competitors',
            label: 'Insights',
            Icon: IconUsers,
            disabled: !hasLocations,
          },
          {
            href: '/dashboard/feedback-demo',
            label: 'Try sample data',
            Icon: IconAlert,
          },
        ]
      : activeFeature === 'playbook'
        ? [
            {
              href: playbookBase,
              label: 'All procedures',
              Icon: IconBook,
              view: 'procedures',
            },
            {
              href: `${playbookBase}?view=review`,
              label: 'Needs your review',
              Icon: IconAlert,
              view: 'review',
              badge: pendingReviewCount || null,
            },
            {
              href: `${playbookBase}?view=tasks`,
              label: 'Tasks',
              Icon: IconUsers,
              view: 'tasks',
            },
          ]
        : [
            {
              href: '/dashboard/settings?section=google-business',
              label: 'Google Business Profile',
              Icon: IconCog,
            },
            {
              href: '/dashboard/youtube',
              label: 'YouTube Studio',
              Icon: IconSend,
            },
          ]

  useEffect(() => {
    function closeMenus(event: PointerEvent) {
      if (!(event.target instanceof Node)) return
      if (!featureMenuRef.current?.contains(event.target))
        setFeatureMenuOpen(false)
      if (!accountMenuRef.current?.contains(event.target))
        setAccountMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFeatureMenuOpen(false)
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

  useEffect(() => {
    function updatePendingReviewCount(event: Event) {
      const count = (event as CustomEvent<{ count?: number }>).detail?.count
      setPendingReviewCount(
        Number.isFinite(count) ? Math.max(0, Math.min(99, Math.floor(count ?? 0))) : 0,
      )
    }

    window.addEventListener('replova:playbook-review-count', updatePendingReviewCount)
    return () =>
      window.removeEventListener('replova:playbook-review-count', updatePendingReviewCount)
  }, [])

  function isActive(item: (typeof navItems)[number]) {
    if ('view' in item && item.view)
      return (
        pathname.startsWith('/dashboard/playbook') && playbookView === item.view
      )
    if ('exact' in item && item.exact) return pathname === item.href
    return pathname.startsWith(item.href.split('?')[0])
  }

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/signin')
  }

  return (
    <aside className={`sidebar ${styles.sidebar}`}>
      <Link
        href="/dashboard"
        className={styles.brand}
        aria-label="Replova dashboard"
      >
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

      <div className={styles.featureSwitcher} ref={featureMenuRef}>
        <span className={styles.controlLabel}>Feature</span>
        <button
          type="button"
          className={styles.featureButton}
          aria-label={`Switch feature. Current feature: ${feature.label}`}
          aria-haspopup="menu"
          aria-expanded={featureMenuOpen}
          onClick={() => setFeatureMenuOpen((open) => !open)}
        >
          <span className={styles.featureGlyph} aria-hidden="true">
            <FeatureIcon s={15} />
          </span>
          <span className={styles.featureCopy}>
            <strong>{feature.label}</strong>
            <small>{feature.description}</small>
          </span>
          <Chevron down={featureMenuOpen} />
        </button>
        {featureMenuOpen ? (
          <div className={styles.featureMenu} role="menu">
            {FEATURES.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                role="menuitem"
                aria-current={item.id === activeFeature ? 'true' : undefined}
                onClick={() => setFeatureMenuOpen(false)}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {item.id === activeFeature ? (
                  <span className={styles.selectedMark} aria-hidden="true" />
                ) : null}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <nav
        className={styles.navigation}
        aria-label={`${feature.label} navigation`}
      >
        <span className={styles.navLabel}>{feature.label}</span>
        <div className={styles.navList}>
          {navItems.map((item) => {
            const active = isActive(item)
            if ('disabled' in item && item.disabled) return null
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                title={item.label}
              >
                <span className={styles.navIcon} aria-hidden="true">
                  <item.Icon s={15} />
                </span>
                <span>{item.label}</span>
                {'badge' in item && item.badge ? (
                  <span className={styles.navCounter}>{item.badge}</span>
                ) : null}
              </Link>
            )
          })}
        </div>
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
