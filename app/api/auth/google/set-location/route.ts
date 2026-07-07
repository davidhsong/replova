import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { locationName } = await req.json()
  if (!locationName || typeof locationName !== 'string') {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }
  // Prevent path traversal / injection into Google API URL segments
  if (!/^accounts\/[^/]+\/locations\/[^/]+$/.test(locationName)) {
    return NextResponse.json({ error: 'Invalid locationName format' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Resolve the single restaurant this location picker was shown for. Updating
  // by owner_email alone would overwrite google_location_name on every
  // restaurant that owner has — this must be scoped to exactly one row.
  let restaurant: { id: string } | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('owner_email', user.email)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const { error } = await admin
    .from('restaurants')
    .update({ google_location_name: locationName })
    .eq('id', restaurant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
