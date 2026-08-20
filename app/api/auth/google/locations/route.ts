import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export type GmbLocation = {
  name: string    // "accounts/xxx/locations/yyy"
  title: string   // business display name
  placeId: string | null
}

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

  if (!restaurant) return NextResponse.json({ error: 'No restaurant found' }, { status: 404 })
  if (!restaurant.google_access_token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  // Always use a valid (possibly refreshed) token
  const accessToken = await getValidGoogleToken(restaurant, admin)
  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get valid Google token. Please reconnect.' }, { status: 401 })
  }

  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  const accountsBody = await accountsRes.text()
  if (!accountsRes.ok) {
    return NextResponse.json(
      { error: `Google accounts API error (${accountsRes.status}). Please reconnect and try again.` },
      { status: 502 }
    )
  }

  const accountsData = JSON.parse(accountsBody) as { accounts?: { name: string }[] }
  const accounts = accountsData.accounts ?? []

  if (!accounts.length) {
    return NextResponse.json({
      locations: [],
      debug: 'No Business Profile accounts found for this Google account. Make sure the signed-in Google account owns or manages a Business Profile.',
    })
  }

  const locations: GmbLocation[] = []

  for (const account of accounts) {
    let pageToken: string | undefined

    do {
      const params = new URLSearchParams({
        readMask: 'name,title,metadata',
        pageSize: '100',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`
      const locRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
      const locBody = await locRes.text()

      if (!locRes.ok) {
        console.error('[GMB locations] Failed to list locations:', locRes.status)
        break
      }

      const locData = JSON.parse(locBody) as {
        locations?: { name: string; title?: string; metadata?: { placeId?: string } }[]
        nextPageToken?: string
      }

      for (const loc of locData.locations ?? []) {
        locations.push({
          name: loc.name,
          title: loc.title ?? loc.name,
          placeId: loc.metadata?.placeId ?? null,
        })
      }

      pageToken = locData.nextPageToken
    } while (pageToken)
  }

  return NextResponse.json({ locations })
}
