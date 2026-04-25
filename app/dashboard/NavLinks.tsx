'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function NavLinks() {
  const pathname = usePathname()
  const router = useRouter()

  function handleReviews(e: React.MouseEvent) {
    e.preventDefault()
    router.push('/dashboard')
    router.refresh()
  }

  const linkClass = (href: string) => {
    const active = pathname === href
    return `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active
        ? 'text-zinc-100 bg-zinc-800'
        : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/60'
    }`
  }

  return (
    <nav className="flex items-center gap-0.5">
      <a href="/dashboard" onClick={handleReviews} className={linkClass('/dashboard')}>
        Reviews
      </a>
      <Link href="/dashboard/review-requests" className={linkClass('/dashboard/review-requests')}>
        Requests
      </Link>
      <Link href="/dashboard/competitors" className={linkClass('/dashboard/competitors')}>
        Competitors
      </Link>
      <Link href="/dashboard/billing" className={linkClass('/dashboard/billing')}>
        Billing
      </Link>
      <Link href="/dashboard/settings" className={linkClass('/dashboard/settings')}>
        Settings
      </Link>
    </nav>
  )
}
