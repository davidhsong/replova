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

  const linkClass = (href: string) =>
    `px-3 py-1.5 text-sm rounded-md transition-colors ${
      pathname === href
        ? 'text-zinc-100 bg-zinc-800'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
    }`

  return (
    <nav className="flex items-center gap-1">
      <a href="/dashboard" onClick={handleReviews} className={linkClass('/dashboard')}>
        Reviews
      </a>
      <Link href="/dashboard/settings" className={linkClass('/dashboard/settings')}>
        Settings
      </Link>
    </nav>
  )
}
