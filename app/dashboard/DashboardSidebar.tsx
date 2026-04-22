'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from './SignOutButton'

interface Props {
  restaurantName: string
  displayName: string
  initials: string
  avatarUrl?: string
}

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Reviews',
    exact: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    exact: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
]

export default function DashboardSidebar({ restaurantName, displayName, initials, avatarUrl }: Props) {
  const pathname = usePathname()

  function isActive(item: typeof NAV_ITEMS[number]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div style={{ padding: '14px 10px 10px', borderBottom: '1px solid var(--border)' }}>
        <Link
          href="/"
          style={{
            background: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '4px',
            borderRadius: 10,
            textDecoration: 'none',
          }}
        >
          <div style={{
            width: 30,
            height: 30,
            background: 'var(--accent)',
            borderRadius: 9,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <span className="sidebar-logo-txt" style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em' }}>
            Replova
          </span>
        </Link>
      </div>

      {/* Nav */}
      <div className="sidebar-body">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${isActive(item) ? 'active' : ''}`}
          >
            {item.icon}
            <span className="nav-lbl">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Footer — user info + sign out */}
      <div className="sidebar-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '4px 4px 8px' }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName || 'Avatar'}
              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent-sub)',
              border: '1px solid oklch(0.61 0.2 258 / 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--accent)',
            }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-usr-name" style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {restaurantName}
            </div>
          </div>
        </div>
        <SignOutButton />
      </div>
    </aside>
  )
}
