import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import {
  GoogleLocationsError,
  listGoogleBusinessLocations,
  type GoogleBusinessLocation,
} from '@/lib/googleLocations'

export type GmbLocation = GoogleBusinessLocation

type RestaurantTokenRow = {
  id: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const select = 'id, google_access_token, google_refresh_token, google_token_expires_at'
  let restaurant: RestaurantTokenRow | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select(select)
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .eq('active', true)
      .maybeSingle<RestaurantTokenRow>()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select(select)
      .eq('owner_email', user.email)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<RestaurantTokenRow>()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'No business found' }, { status: 404 })
  if (!restaurant.google_access_token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  // Always use a valid (possibly refreshed) token
  const accessToken = await getValidGoogleToken(restaurant, admin)
  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get valid Google token. Please reconnect.' }, { status: 401 })
  }

  try {
    const locations = await listGoogleBusinessLocations(accessToken)
    return NextResponse.json({ locations })
  } catch (error) {
    const status = error instanceof GoogleLocationsError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Unable to load Google Business locations.'
    return NextResponse.json({ error: message }, { status })
  }
}
