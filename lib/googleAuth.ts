import { SupabaseClient } from '@supabase/supabase-js'

type RestaurantTokenFields = {
  id: string
  google_access_token: string | null
  google_refresh_token: string | null
  google_token_expires_at: number | null
}

const FIVE_MINUTES = 5 * 60 * 1000

export async function getValidGoogleToken(
  restaurant: RestaurantTokenFields,
  admin: SupabaseClient
): Promise<string | null> {
  const needsRefresh =
    !restaurant.google_token_expires_at ||
    Date.now() > restaurant.google_token_expires_at - FIVE_MINUTES

  if (!needsRefresh) return restaurant.google_access_token
  if (!restaurant.google_refresh_token) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: restaurant.google_refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Google token refresh failed:', body)

    // A 4xx response (e.g. invalid_grant) means the refresh token itself is
    // dead — usually because the user revoked access from their Google
    // account. Clear the stored tokens so the app stops retrying a doomed
    // refresh on every sync and the Settings page correctly shows
    // "not connected" / prompts the user to reconnect, instead of silently
    // failing forever while still showing as "Connected".
    if (res.status >= 400 && res.status < 500) {
      await admin
        .from('restaurants')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
        })
        .eq('id', restaurant.id)
    }

    return null
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  const expiresAt = Date.now() + data.expires_in * 1000

  await admin
    .from('restaurants')
    .update({ google_access_token: data.access_token, google_token_expires_at: expiresAt })
    .eq('id', restaurant.id)

  return data.access_token
}
