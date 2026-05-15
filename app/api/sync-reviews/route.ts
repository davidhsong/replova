import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { syncRestaurantReviews } from '@/lib/syncReviews'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value

  let restaurant: { id: string; active: boolean } | null = null

  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id, active')
      .eq('id', activeId)
      .eq('owner_email', user.email!)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id, active')
      .eq('owner_email', user.email!)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  if (!restaurant.active) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  try {
    const result = await syncRestaurantReviews(restaurant.id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    console.error('sync-reviews error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
