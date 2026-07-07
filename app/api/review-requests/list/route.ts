import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  let restaurant: { id: string } | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', activeId)
      .eq('owner_email', user.email!)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('owner_email', user.email!)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (restaurantId && restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: rows } = await admin
    .from('review_requests')
    .select('id, customer_name, customer_email, status, sent_at, created_at')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json(rows ?? [])
}
