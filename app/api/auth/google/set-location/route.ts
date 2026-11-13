import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { GoogleLocationsError, listGoogleBusinessLocations } from '@/lib/googleLocations'

type RestaurantLocationRow = {
  id: string
  place_id: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { locationName } = await req.json().catch(() => ({ locationName: null }))
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
  // restaurant that owner has. This must be scoped to exactly one row.
  const restaurantSelect = 'id, place_id, google_access_token, google_refresh_token, google_token_expires_at'
  let restaurant: RestaurantLocationRow | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select(restaurantSelect)
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .eq('active', true)
      .maybeSingle<RestaurantLocationRow>()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select(restaurantSelect)
      .eq('owner_email', user.email)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<RestaurantLocationRow>()
    restaurant = data
  }

  if (!restaurant) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const accessToken = await getValidGoogleToken(restaurant, admin)
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Google session expired. Please reconnect in Settings.' },
      { status: 401 }
    )
  }

  let selectedLocation
  try {
    const locations = await listGoogleBusinessLocations(accessToken)
    selectedLocation = locations.find(location => location.name === locationName)
  } catch (error) {
    const status = error instanceof GoogleLocationsError ? error.status : 502
    const message = error instanceof Error ? error.message : 'Unable to verify that Google location.'
    return NextResponse.json({ error: message }, { status })
  }

  if (!selectedLocation) {
    return NextResponse.json(
      { error: 'That location is not available to the connected Google account.' },
      { status: 403 }
    )
  }

  const { error } = await admin
    .from('restaurants')
    .update({
      google_location_name: selectedLocation.name,
      place_id: selectedLocation.placeId ?? restaurant.place_id,
    })
    .eq('id', restaurant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
