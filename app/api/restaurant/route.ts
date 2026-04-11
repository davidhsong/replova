import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, google_refresh_token, google_location_name')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: restaurant.id,
    name: restaurant.name,
    // true only when both token and location are present
    googleConnected: !!(restaurant.google_refresh_token && restaurant.google_location_name),
    // token exists but location wasn't matched during OAuth
    googleTokenOnly: !!(restaurant.google_refresh_token && !restaurant.google_location_name),
  })
}
