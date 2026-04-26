'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  IconMessage, IconUsers, IconSend, IconCard, IconCog,
  IconChevDown, IconSignOut,
} from '@/components/icons'
import { getSupabaseBrowser } from '@/lib/supabase'
import LocationSwitcherClient from '@/components/dashboard/LocationSwitcherClient'
import type { Plan } from '@/lib/planLimits'

type Location = { id: string; name: string }

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
  { href: '/dashboard/review-requests', label: 'Requests', Icon: IconSend, exact: false, showsBadge: false },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/billing', label: 'Billing', Icon: IconCard },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconCog },
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
    <aside className="sidebar">
      {/* Workspace switcher */}
      <div style={{ borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
          <Image
            src="/replova-logo.png"
            alt="Replova"
            width={28}
            height={28}
            style={{ borderRadius: 7, flexShrink: 0 }}
          />
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

      {/* Nav */}
      <div style={{ padding: '12px 0', flex: 1, overflowY: 'auto' }}>
        <div className="nav-group">
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--t4)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '4px 10px 8px',
          }}>
            Workspace
          </div>
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

        <div className="nav-group" style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, color: 'var(--t4)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '4px 10px 8px',
          }}>
            Account
          </div>
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

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--line)', padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8 }}>
          {avatarUrl ? (
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
            className="btn-quiet btn-sm"
            style={{ padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}
          >
            <IconSignOut s={13} />
          </button>
        </div>
      </div>
    </aside>
  )
}
