import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/baseUrl'
import { getSupabaseAdmin } from '@/lib/supabase'
import { decryptYouTubeToken, encryptYouTubeToken } from '@/lib/youtubeAuth'
import { createClient } from '@/utils/supabase/server'

const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl'

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
}

type ChannelResponse = {
  items?: Array<{ id: string; snippet?: { title?: string } }>
}

export const dynamic = 'force-dynamic'

function settingsRedirect(code: string, success = false) {
  const key = success ? 'youtube_success' : 'youtube_error'
  const response = NextResponse.redirect(new URL(`/dashboard/settings?${key}=${encodeURIComponent(code)}`, BASE_URL))
  response.cookies.delete('youtube_oauth_state')
  return response
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { searchParams } = new URL(request.url)

  if (searchParams.get('error')) return settingsRedirect('access_denied')

  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const savedState = cookieStore.get('youtube_oauth_state')?.value
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return settingsRedirect('state_mismatch')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return settingsRedirect('session_expired')
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY) {
    return settingsRedirect('not_configured')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${BASE_URL}/api/auth/youtube/callback`,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })

  if (!tokenResponse.ok) {
    console.error(`[YouTube OAuth] Token exchange failed with status ${tokenResponse.status}`)
    return settingsRedirect('token_exchange_failed')
  }

  const tokens = await tokenResponse.json() as TokenResponse
  const grantedScopes = (tokens.scope ?? '').split(/\s+/).filter(Boolean)
  if (!tokens.access_token || !tokens.expires_in || !grantedScopes.includes(REQUIRED_SCOPE)) {
    return settingsRedirect('missing_permissions')
  }

  const channelResponse = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: 'no-store' }
  )
  if (!channelResponse.ok) {
    console.error(`[YouTube OAuth] Channel lookup failed with status ${channelResponse.status}`)
    return settingsRedirect('channel_lookup_failed')
  }

  const channelData = await channelResponse.json() as ChannelResponse
  const channel = channelData.items?.[0]
  if (!channel?.id) return settingsRedirect('channel_not_found')

  const admin = getSupabaseAdmin()
  const { data: existing } = await admin
    .from('youtube_connections')
    .select('refresh_token_encrypted')
    .eq('user_id', user.id)
    .maybeSingle<{ refresh_token_encrypted: string }>()

  let refreshToken = tokens.refresh_token
  if (!refreshToken && existing?.refresh_token_encrypted) {
    try {
      refreshToken = decryptYouTubeToken(existing.refresh_token_encrypted)
    } catch (error) {
      console.error('[YouTube OAuth] Existing refresh token could not be decrypted:', error)
    }
  }
  if (!refreshToken) return settingsRedirect('missing_refresh_token')

  const now = new Date().toISOString()
  const { error: saveError } = await admin.from('youtube_connections').upsert({
    user_id: user.id,
    channel_id: channel.id,
    channel_title: channel.snippet?.title ?? null,
    access_token_encrypted: encryptYouTubeToken(tokens.access_token),
    refresh_token_encrypted: encryptYouTubeToken(refreshToken),
    token_expires_at: Date.now() + tokens.expires_in * 1000,
    granted_scopes: grantedScopes,
    updated_at: now,
  }, { onConflict: 'user_id' })

  if (saveError) {
    console.error('[YouTube OAuth] Failed to save connection:', saveError.message)
    return settingsRedirect('save_failed')
  }
  return settingsRedirect('true', true)
}
