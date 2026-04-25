import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'
import DashboardSidebar from './DashboardSidebar'
import TermsModal from './TermsModal'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()

  // Fetch all locations for this user
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name')
    .eq('owner_email', user.email)
    .order('created_at', { ascending: true })

  if (!restaurants || restaurants.length === 0) redirect('/onboard')

  // Resolve active location from cookie, fall back to first
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  const activeRestaurant = restaurants.find(r => r.id === activeId) ?? restaurants[0]

  // Get account — plan, terms acceptance, and first restaurant created_at for trial end date
  const { data: account } = await admin
    .from('accounts')
    .select('plan, terms_accepted_at')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  const limits = getPlanLimits(plan)
  const needsTermsAcceptance = !account?.terms_accepted_at

  // Trial end date: 30 days from first restaurant creation
  const { data: firstRestaurant } = await admin
    .from('restaurants')
    .select('created_at')
    .eq('owner_email', user.email!)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const trialEnd = firstRestaurant
    ? new Date(new Date(firstRestaurant.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const trialEndDate = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

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
        restaurantName={activeRestaurant.name}
        displayName={displayName}
        initials={initials}
        avatarUrl={avatarUrl}
        locations={restaurants}
        activeLocationId={activeRestaurant.id}
        locationLimit={limits.locations}
      />
      <main className="main">{children}</main>
      {needsTermsAcceptance && (
        <TermsModal plan={plan} trialEndDate={trialEndDate} />
      )}
    </div>
  )
}
