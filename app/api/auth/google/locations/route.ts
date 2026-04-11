import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, place_id, google_access_token, google_refresh_token, google_token_expires_at, google_location_name')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'No restaurant found' }, { status: 404 })
  if (!restaurant.google_access_token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const accessToken = restaurant.google_access_token

  // Step 1: list accounts
  const accountsRes = await fetch('https://mybusiness.googleapis.com/v4/accounts', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const accountsRaw = await accountsRes.text()

  if (!accountsRes.ok) {
    return NextResponse.json({
      step: 'accounts',
      status: accountsRes.status,
      error: accountsRaw,
      place_id_we_have: restaurant.place_id,
    })
  }

  const accountsData = JSON.parse(accountsRaw)
  const accounts = accountsData.accounts ?? []

  if (accounts.length === 0) {
    return NextResponse.json({
      step: 'accounts',
      message: 'No accounts returned — API may not be enabled or this Google account has no Business Profile',
      raw: accountsData,
      place_id_we_have: restaurant.place_id,
    })
  }

  // Step 2: list locations for each account
  const results: object[] = []

  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusiness.googleapis.com/v4/${account.name}/locations?pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const locRaw = await locRes.text()

    if (!locRes.ok) {
      results.push({ account: account.name, status: locRes.status, error: locRaw })
      continue
    }

    const locData = JSON.parse(locRaw)
    results.push({
      account: account.name,
      locations: locData.locations ?? [],
      raw: locData,
    })

    // Try to auto-match and save
    const match = (locData.locations ?? []).find(
      (loc: { locationKey?: { placeId?: string } }) =>
        loc.locationKey?.placeId === restaurant.place_id
    )

    if (match) {
      await getSupabaseAdmin()
        .from('restaurants')
        .update({ google_location_name: match.name })
        .eq('id', restaurant.id)

      return NextResponse.json({
        success: true,
        matched: match.name,
        place_id_we_have: restaurant.place_id,
        all_results: results,
      })
    }
  }

  return NextResponse.json({
    step: 'locations',
    message: 'No location matched your place_id — see all_results to find the right one manually',
    place_id_we_have: restaurant.place_id,
    all_results: results,
  })
}
