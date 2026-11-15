import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/baseUrl'
import { getSupabaseAdmin } from '@/lib/supabase'
import { decryptYouTubeToken, encryptYouTubeToken } from '@/lib/youtubeAuth'
import {
  canReconnectYouTubeChannel,
  getYouTubeRedirectUri,
  verifyYouTubeOAuthState,
  youtubeOAuthStatesMatch,
} from '@/lib/youtubeOAuth'
import { getYouTubeWorkspaceForUser } from '@/lib/youtubeWorkspace'
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

type ExistingConnection = {
  id: string
  channel_id: string
  refresh_token_encrypted: string
}

export const dynamic = 'force-dynamic'

function settingsRedirect(code: string, success = false) {
  const key = success ? 'youtube_success' : 'youtube_error'
  const response = NextResponse.redirect(new URL(`/dashboard/settings?${key}=${encodeURIComponent(code)}`, BASE_URL))
  for (const path of ['/api/auth/youtube/callback', '/api/auth/youtube']) {
    response.cookies.set('youtube_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path,
    })
  }
  return response
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { searchParams } = new URL(request.url)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return settingsRedirect('session_expired')
  if (!user.email || !user.email_confirmed_at) return settingsRedirect('email_unverified')
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY) {
    return settingsRedirect('not_configured')
  }

  const admin = getSupabaseAdmin()
  let workspaceContext: Awaited<ReturnType<typeof getYouTubeWorkspaceForUser>>
  let redirectUri: string
  try {
    workspaceContext = await getYouTubeWorkspaceForUser(admin, user)
    redirectUri = getYouTubeRedirectUri()
  } catch (error) {
    console.error('[YouTube OAuth] Unable to validate callback context:', error instanceof Error ? error.name : 'UnknownError')
    return settingsRedirect('not_configured')
  }
  if (!workspaceContext) return settingsRedirect('workspace_required')

  const returnedState = searchParams.get('state')
  const savedState = cookieStore.get('youtube_oauth_state')?.value
  if (
    !returnedState
    || !savedState
    || !youtubeOAuthStatesMatch(returnedState, savedState)
    || !verifyYouTubeOAuthState({
      state: returnedState,
      userId: user.id,
      workspaceId: workspaceContext.workspace.id,
    })
  ) {
    return settingsRedirect('state_mismatch')
  }

  if (searchParams.get('error')) {
    return settingsRedirect(searchParams.get('error') === 'access_denied' ? 'access_denied' : 'authorization_failed')
  }
  const code = searchParams.get('code')
  if (!code) return settingsRedirect('authorization_failed')

  let tokenResponse: Response
  try {
    tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
  } catch {
    return settingsRedirect('token_exchange_failed')
  }

  if (!tokenResponse.ok) {
    console.error(`[YouTube OAuth] Token exchange failed with status ${tokenResponse.status}`)
    return settingsRedirect('token_exchange_failed')
  }

  const tokens = await tokenResponse.json().catch(() => ({})) as TokenResponse
  const grantedScopes = (tokens.scope ?? '').split(/\s+/).filter(Boolean)
  if (
    !tokens.access_token
    || typeof tokens.expires_in !== 'number'
    || !Number.isFinite(tokens.expires_in)
    || tokens.expires_in <= 0
    || !grantedScopes.includes(REQUIRED_SCOPE)
  ) {
    return settingsRedirect('missing_permissions')
  }

  let channelResponse: Response
  try {
    channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id%2Csnippet&mine=true',
      { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: 'no-store' }
    )
  } catch {
    return settingsRedirect('channel_lookup_failed')
  }
  if (!channelResponse.ok) {
    console.error(`[YouTube OAuth] Channel lookup failed with status ${channelResponse.status}`)
    return settingsRedirect('channel_lookup_failed')
  }

  const channelData = await channelResponse.json().catch(() => ({})) as ChannelResponse
  const channel = channelData.items?.[0]
  if (!channel?.id) return settingsRedirect('channel_not_found')

  const { data: existing, error: existingError } = await admin
    .from('youtube_connections')
    .select('id, channel_id, refresh_token_encrypted')
    .eq('user_id', user.id)
    .maybeSingle<ExistingConnection>()
  if (existingError) {
    console.error('[YouTube OAuth] Existing connection lookup failed:', existingError.code)
    return settingsRedirect('save_failed')
  }
  if (!canReconnectYouTubeChannel(existing?.channel_id, channel.id)) {
    return settingsRedirect('channel_mismatch')
  }

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
  let accessTokenEncrypted: string
  let refreshTokenEncrypted: string
  try {
    accessTokenEncrypted = encryptYouTubeToken(tokens.access_token)
    refreshTokenEncrypted = encryptYouTubeToken(refreshToken)
  } catch (error) {
    console.error('[YouTube OAuth] Token encryption failed:', error instanceof Error ? error.name : 'UnknownError')
    return settingsRedirect('save_failed')
  }
  const { error: saveError } = await admin.from('youtube_connections').upsert({
    user_id: user.id,
    channel_id: channel.id,
    channel_title: channel.snippet?.title ?? null,
    access_token_encrypted: accessTokenEncrypted,
    refresh_token_encrypted: refreshTokenEncrypted,
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
