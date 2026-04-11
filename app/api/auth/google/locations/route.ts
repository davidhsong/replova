import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export type GmbLocation = {
  name: string    // "accounts/xxx/locations/yyy"
  title: string   // business display name
  placeId: string | null
}

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, google_access_token')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'No restaurant found' }, { status: 404 })
  if (!restaurant.google_access_token) return NextResponse.json({ error: 'Google not connected' }, { status: 400 })

  const accessToken = restaurant.google_access_token

  const accountsRes = await fetch(
    'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!accountsRes.ok) {
    const text = await accountsRes.text()
    return NextResponse.json({ error: `Failed to list accounts: ${text}` }, { status: 502 })
  }

  const { accounts } = (await accountsRes.json()) as { accounts?: { name: string }[] }

  if (!accounts?.length) {
    return NextResponse.json({
      locations: [],
      message: 'This Google account has no Business Profile.',
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

      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!locRes.ok) break

      const locData = (await locRes.json()) as {
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
