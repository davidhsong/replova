import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import DashboardSidebar from './DashboardSidebar'

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
    <div className="app-shell dark-app">
      <DashboardSidebar
        restaurantName={restaurant.name}
        displayName={displayName}
        initials={initials}
        avatarUrl={avatarUrl}
      />
      <main className="main">{children}</main>
    </div>
  )
}
