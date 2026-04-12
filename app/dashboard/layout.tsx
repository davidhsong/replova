import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import SignOutButton from './SignOutButton'
import NavLinks from './NavLinks'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) redirect('/onboard')

  const displayName = (user.user_metadata?.display_name as string | undefined) ?? ''
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const initials = (displayName || (user.email ?? ''))
    .split(/[\s@]/)
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="min-h-dvh bg-zinc-950">
      <header className="border-b border-zinc-800/80 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-zinc-100 tracking-tight"
            >
              Replova
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <NavLinks />
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/settings" className="flex items-center gap-2 group" title="Settings">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName || 'Profile'}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-700 group-hover:ring-zinc-500 transition-all"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-400 transition-colors ring-1 ring-zinc-700 group-hover:ring-zinc-600">
                  {initials}
                </div>
              )}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
