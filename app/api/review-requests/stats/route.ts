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
      .eq('active', true)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('owner_email', user.email!)
      .eq('active', true)
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

  const { data: rows, error } = await admin
    .from('review_requests')
    .select('status')
    .eq('restaurant_id', restaurant.id)
  if (error) return NextResponse.json({ error: 'Unable to load review request statistics.' }, { status: 500 })

  const all = rows ?? []
  const total   = all.length
  const pending = all.filter(r => r.status === 'pending').length
  const sent    = all.filter(r => r.status === 'sent').length
  const opened  = all.filter(r => r.status === 'opened').length
  const clicked = all.filter(r => r.status === 'clicked').length

  const sentOrBetter = sent + opened + clicked
  const openRate  = sentOrBetter > 0 ? (opened + clicked) / sentOrBetter : 0
  const clickRate = sentOrBetter > 0 ? clicked / sentOrBetter : 0

  return NextResponse.json({ total, pending, sent, opened, clicked, openRate, clickRate })
}
