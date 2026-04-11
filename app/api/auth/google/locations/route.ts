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
    .select('id, place_id, google_access_token, google_location_name')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'No restaurant found' }, { status: 404 })
  if (!restaurant.google_access_token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const accessToken = restaurant.google_access_token

  // Step 1: list accounts via Account Management API v1
  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

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
  const accounts: { name: string }[] = accountsData.accounts ?? []

  if (accounts.length === 0) {
    return NextResponse.json({
      step: 'accounts',
      message: 'No accounts returned — this Google account may have no Business Profile',
      raw: accountsData,
      place_id_we_have: restaurant.place_id,
    })
  }

  // Step 2: list locations for each account via Business Information API v1
  const results: object[] = []

  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,metadata&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const locRaw = await locRes.text()

    if (!locRes.ok) {
      results.push({ account: account.name, status: locRes.status, error: locRaw })
      continue
    }

    const locData = JSON.parse(locRaw) as {
      locations?: { name: string; metadata?: { placeId?: string } }[]
    }

    results.push({
      account: account.name,
      locations: locData.locations ?? [],
    })

    // Try to auto-match by placeId and save if found
    const match = (locData.locations ?? []).find(
      loc => loc.metadata?.placeId === restaurant.place_id
    )

    if (match) {
      await getSupabaseAdmin()
        .from('restaurants')
        .update({ google_location_name: match.name })
        .eq('id', restaurant.id)

      return NextResponse.json({
        success: true,
        message: 'Location matched and saved!',
        matched_location: match.name,
        place_id_we_have: restaurant.place_id,
      })
    }
  }

  return NextResponse.json({
    success: false,
    message: 'No location matched your place_id. See all_results for the locations Google returned.',
    place_id_we_have: restaurant.place_id,
    all_results: results,
  })
}
