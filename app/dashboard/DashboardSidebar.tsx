'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  IconMessage, IconUsers, IconBriefcase, IconCard, IconCog,
  IconChevDown, IconSignOut, IconSend, IconUpload,
} from '@/components/icons'
import { getSupabaseBrowser } from '@/lib/supabase'
import LocationSwitcherClient from '@/components/dashboard/LocationSwitcherClient'
import type { Plan } from '@/lib/planLimits'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'

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
  isCareersAdmin: boolean
}

const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
}

const TOP_ITEMS = [
  { href: '/dashboard', label: 'Reviews', Icon: IconMessage, exact: true, showsBadge: true },
  { href: '/dashboard/youtube/replies', label: 'YouTube Queue', Icon: IconSend, exact: false, showsBadge: false },
  { href: '/dashboard/competitors', label: 'Competitors', Icon: IconUsers, exact: false, showsBadge: false },
]

const BOTTOM_ITEMS = [
  { href: '/dashboard/review-requests', label: 'Review Requests', Icon: IconUpload },
  { href: '/dashboard/billing', label: 'Billing', Icon: IconCard },
  { href: '/dashboard/settings', label: 'Settings', Icon: IconCog },
]

const MOBILE_PRIMARY_ITEMS = [
  { href: '/dashboard', label: 'Reviews', Icon: IconMessage, exact: true },
  { href: '/dashboard/youtube/replies', label: 'YouTube', Icon: IconSend, exact: false },
  { href: '/dashboard/competitors', label: 'Compare', Icon: IconUsers, exact: false },
]

function MoreIcon({ s = 18 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

export default function DashboardSidebar({
  restaurantName, plan, displayName, initials, avatarUrl, userEmail,
  locations, activeLocationId, locationLimit, awaitingCount, isCareersAdmin,
}: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)

  useEffect(() => {
    if (!mobileMoreOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMoreOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileMoreOpen])

  function active(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut()
    router.push('/signin')
  }

  return (
    <>
    <header className="mobile-app-header">
      <Link href="/dashboard" className="mobile-app-brand" aria-label="Replova dashboard">
        <ReplovaLogo variant="primary" surface="light" height={21} decorative eager />
      </Link>
      <div className="mobile-app-context" aria-label={`Current workspace: ${restaurantName}`}>
        <span>{restaurantName}</span>
        <small>{PLAN_LABELS[plan]}</small>
      </div>
    </header>
    <aside className="sidebar">
      <Link href="/dashboard" className="dashboard-brand" aria-label="Replova dashboard">
        <ReplovaLogo variant="primary" surface="light" height={24} decorative eager />
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
          {[...TOP_ITEMS, ...(isCareersAdmin ? [{ href: '/dashboard/applicants', label: 'Applicants', Icon: IconBriefcase, exact: false, showsBadge: false }] : [])].map(({ href, label, Icon, exact, showsBadge }) => {
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
      {MOBILE_PRIMARY_ITEMS.map(({ href, label, Icon, exact }) => {
        const isActive = active(href, exact)
        return (
          <Link key={href} href={href} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
            <Icon s={18} />
            <span>{label}</span>
          </Link>
        )
      })}
      <button
        type="button"
        className={mobileMoreOpen || BOTTOM_ITEMS.some(item => active(item.href)) || (isCareersAdmin && active('/dashboard/applicants')) ? 'active' : ''}
        aria-expanded={mobileMoreOpen}
        aria-controls="mobile-more-menu"
        onClick={() => setMobileMoreOpen(open => !open)}
      >
        <MoreIcon />
        <span>More</span>
      </button>
    </nav>
    {mobileMoreOpen && (
      <>
        <button
          type="button"
          className="mobile-more-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileMoreOpen(false)}
        />
        <section id="mobile-more-menu" className="mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More dashboard destinations">
          <div className="mobile-more-handle" aria-hidden="true" />
          <div className="mobile-more-heading">
            <div>
              <strong>More</strong>
              <span>{restaurantName}</span>
            </div>
            <button type="button" className="mobile-sheet-close" onClick={() => setMobileMoreOpen(false)} aria-label="Close menu">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          {locations.length > 1 && (
            <div className="mobile-location-switcher">
              <span>Workspace</span>
              <LocationSwitcherClient
                locations={locations}
                activeLocationId={activeLocationId}
                locationLimit={locationLimit}
                currentCount={locations.length}
              />
            </div>
          )}
          <div className="mobile-more-links">
            {[...BOTTOM_ITEMS, ...(isCareersAdmin ? [{ href: '/dashboard/applicants', label: 'Applicants', Icon: IconBriefcase }] : [])].map(({ href, label, Icon }) => {
              const isActive = active(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={isActive ? 'active' : ''}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <span className="mobile-more-icon"><Icon s={18} /></span>
                  <span>{label}</span>
                  <span className="mobile-more-chevron" aria-hidden="true">›</span>
                </Link>
              )
            })}
          </div>
          <div className="mobile-more-account">
            <div className="mobile-more-avatar" aria-hidden="true">{initials}</div>
            <div>
              <strong>{displayName || restaurantName}</strong>
              <span>{userEmail}</span>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Sign out">
              <IconSignOut s={18} />
            </button>
          </div>
        </section>
      </>
    )}
    </>
  )
}
