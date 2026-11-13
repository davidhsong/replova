'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  IconMessage, IconUsers, IconCard, IconCog,
  IconChevDown, IconSignOut,
} from '@/components/icons'
import { getSupabaseBrowser } from '@/lib/supabase'
import LocationSwitcherClient from '@/components/dashboard/LocationSwitcherClient'
import type { Plan } from '@/lib/planLimits'

type Location = { id: string; name: string; active: boolean }

interface Props {
  restaurantName: string
  plan: Plan
  displayName: string
  initials: string
  avatarUrl?: string
  userEmail: string
  locations: Location[]
  activeLocationId: string
  locationLimit: number
  awaitingCount: number
}

const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
}

const TOP_ITEMS = [
  { href: '/dashboard', label: 'Reviews', Icon: IconMessage, exact: true, showsBadge: true },
  { href: '/dashboard/competitors', label: 'Competitors', Icon: IconUsers, exact: false, showsBadge: false },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/billing', label: 'Billing', Icon: IconCard },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconCog },
]

const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Reviews', Icon: IconMessage, exact: true },
  { href: '/dashboard/competitors', label: 'Compare', Icon: IconUsers, exact: false },
  { href: '/dashboard/billing', label: 'Billing', Icon: IconCard, exact: false },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconCog, exact: false },
]

export default function DashboardSidebar({
  restaurantName, plan, displayName, initials, avatarUrl, userEmail,
  locations, activeLocationId, locationLimit, awaitingCount,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()

  function active(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/signin')
  }

  return (
    <>
    <aside className="sidebar">
      <Link href="/dashboard" className="dashboard-brand" aria-label="Replova dashboard">
        <Image src="/replova-logo-transparent.png" alt="" width={24} height={24} />
        <span>Replova</span>
      </Link>

      {/* Workspace switcher */}
      <div className="dashboard-workspace">
        <div className="dashboard-workspace-row">
          <div className="workspace-symbol" aria-hidden="true">{restaurantName.slice(0, 1).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, color: 'var(--t1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {restaurantName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
              {locations.length} location{locations.length !== 1 ? 's' : ''} · {PLAN_LABELS[plan]}
            </div>
          </div>
          {locations.length > 1 && (
            <span style={{ color: 'var(--t3)' }}>
              <IconChevDown s={12} sw={2} />
            </span>
          )}
        </div>

        {locations.length > 1 && (
          <LocationSwitcherClient
            locations={locations}
            activeLocationId={activeLocationId}
            locationLimit={locationLimit}
            currentCount={locations.length}
          />
        )}
      </div>

      <div className="dashboard-nav-scroll">
        <div className="nav-group">
          {TOP_ITEMS.map(({ href, label, Icon, exact, showsBadge }) => {
            const isActive = active(href, exact)
            const badge = showsBadge && awaitingCount > 0 ? awaitingCount : null
            return (
              <Link key={href} href={href} className={`nav-item${isActive ? ' active' : ''}`}>
                <span className="ico" style={{ color: isActive ? 'var(--accent)' : undefined }}>
                  <Icon s={14} />
                </span>
                <span>{label}</span>
                {badge !== null && <span className="nav-counter">{badge}</span>}
              </Link>
            )
          })}
        </div>

        <div className="nav-group dashboard-nav-secondary">
          {BOTTOM_ITEMS.map(({ href, label, Icon }) => {
            const isActive = active(href)
            return (
              <Link key={href} href={href} className={`nav-item${isActive ? ' active' : ''}`}>
                <span className="ico" style={{ color: isActive ? 'var(--accent)' : undefined }}>
                  <Icon s={14} />
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="dashboard-user-footer">
        <div className="dashboard-user-row">
          {avatarUrl ? (
            // User avatars can be hosted on arbitrary OAuth provider domains.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent-sub)', border: '1px solid var(--accent-line)',
              color: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: 10, fontWeight: 700,
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--t1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {displayName || restaurantName}
            </div>
            <div style={{
              fontSize: 11, color: 'var(--t3)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {userEmail}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="btn-quiet btn-sm"
            style={{ padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
          >
            <IconSignOut s={13} />
          </button>
        </div>
      </div>
    </aside>
    <nav className="mobile-nav" aria-label="Dashboard navigation">
      {MOBILE_ITEMS.map(({ href, label, Icon, exact }) => {
        const isActive = active(href, exact)
        return (
          <Link key={href} href={href} className={isActive ? 'active' : ''}>
            <Icon s={16} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
    </>
  )
}
