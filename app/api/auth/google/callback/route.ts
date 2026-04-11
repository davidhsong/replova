import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL!

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { searchParams } = new URL(req.url)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // User denied access
  if (error) {
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=access_denied`
    )
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=invalid_callback`
    )
  }

  // Verify CSRF state
  const savedState = cookieStore.get('google_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=state_mismatch`
    )
  }

  // Verify the user is still authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${BASE_URL}/signin`)
  }

  const admin = getSupabaseAdmin()

  // Verify the state matches the user's restaurant (not someone else's)
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, place_id')
    .eq('id', state)
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) {
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=restaurant_not_found`
    )
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${BASE_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }).toString(),
  })

  if (!tokenRes.ok) {
    console.error('Google token exchange failed:', await tokenRes.text())
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=token_exchange_failed`
    )
  }

  const tokenData = await tokenRes.json()
  const {
    access_token,
    refresh_token,
    expires_in,
  } = tokenData as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  if (!access_token || !refresh_token) {
    console.error('Missing tokens in Google response:', tokenData)
    return NextResponse.redirect(
      `${BASE_URL}/dashboard/settings?google_error=missing_tokens`
    )
  }

  const expiresAt = Date.now() + expires_in * 1000

  // Find the Google Business location matching this restaurant's place_id
  const locationName = await findLocationByPlaceId(
    access_token,
    restaurant.place_id
  )

  // Store tokens (and location if found)
  await admin
    .from('restaurants')
    .update({
      google_access_token: access_token,
      google_refresh_token: refresh_token,
      google_token_expires_at: expiresAt,
      ...(locationName ? { google_location_name: locationName } : {}),
    })
    .eq('id', restaurant.id)

  // Clear the state cookie
  const response = NextResponse.redirect(
    locationName
      ? `${BASE_URL}/dashboard/settings?google_success=true`
      : `${BASE_URL}/dashboard/settings?google_success=true&google_warning=location_not_found`
  )
  response.cookies.delete('google_oauth_state')
  return response
}

/**
 * Uses the Google Business Profile APIs (v1) to find the location
 * whose placeId matches the restaurant's Google Place ID.
 * Falls back to the single location if only one exists across all accounts.
 */
async function findLocationByPlaceId(
  accessToken: string,
  placeId: string
): Promise<string | null> {
  try {
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!accountsRes.ok) {
      console.error('Failed to list Google accounts:', await accountsRes.text())
      return null
    }

    const { accounts } = (await accountsRes.json()) as {
      accounts?: { name: string }[]
    }
    if (!accounts?.length) return null

    const allLocations: { name: string; metadata?: { placeId?: string } }[] = []

    for (const account of accounts) {
      let pageToken: string | undefined

      do {
        const params = new URLSearchParams({
          readMask: 'name,title,metadata',
          pageSize: '100',
        })
        if (pageToken) params.set('pageToken', pageToken)

        const locRes = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!locRes.ok) break

        const locData = (await locRes.json()) as {
          locations?: { name: string; metadata?: { placeId?: string } }[]
          nextPageToken?: string
        }

        allLocations.push(...(locData.locations ?? []))
        pageToken = locData.nextPageToken
      } while (pageToken)
    }

    // First: exact placeId match
    const exact = allLocations.find(loc => loc.metadata?.placeId === placeId)
    if (exact) return exact.name

    // Fallback: if the account has exactly one location, use it automatically
    if (allLocations.length === 1) return allLocations[0].name

    return null
  } catch (err) {
    console.error('Error finding Google Business location:', err)
    return null
  }
}
