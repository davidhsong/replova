import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getPlanLimits } from '@/lib/planLimits'
import type { Plan } from '@/lib/planLimits'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // Prefer active location cookie, fall back to first restaurant
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  let restaurant: { id: string; name: string; active: boolean; cuisine_type: string | null; google_refresh_token: string | null; google_location_name: string | null } | null = null

  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, active, cuisine_type, google_refresh_token, google_location_name')
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .eq('active', true)
      .single()
    restaurant = data
  }

  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, active, cuisine_type, google_refresh_token, google_location_name')
      .eq('owner_email', user.email)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get account for plan info
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  const limits = getPlanLimits(plan)

  return NextResponse.json({
    id: restaurant.id,
    name: restaurant.name,
    active: restaurant.active,
    cuisineType: restaurant.cuisine_type ?? null,
    plan,
    competitorLimit: limits.competitors,
    locationLimit: limits.locations,
    googleConnected: !!(restaurant.google_refresh_token && restaurant.google_location_name),
    googleTokenOnly: !!(restaurant.google_refresh_token && !restaurant.google_location_name),
  })
}
