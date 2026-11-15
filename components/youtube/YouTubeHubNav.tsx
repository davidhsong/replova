'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS = [
  { href: '/dashboard/youtube', label: 'Overview', exact: true },
  { href: '/dashboard/youtube/videos', label: 'All Videos' },
  { href: '/dashboard/youtube/playlists', label: 'Playlists' },
  { href: '/dashboard/youtube/replies', label: 'Reply Queue' },
  { href: '/dashboard/settings#youtube', label: 'YouTube Settings', settings: true },
]

export default function YouTubeHubNav() {
  const pathname = usePathname()
  return (
    <nav className="youtube-studio-nav" aria-label="YouTube management">
      <div className="youtube-studio-nav-brand">
        <span aria-hidden="true" />
        <strong>YouTube</strong>
      </div>
      <div className="youtube-studio-nav-links">
        {ITEMS.map(item => {
          const active = item.settings
            ? false
            : item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'is-active' : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
