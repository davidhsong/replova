import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'
import { getGoogleBusinessAvailability } from '@/lib/googleBusinessFeature'
import {
  GOOGLE_BUSINESS_OAUTH_STATE_COOKIE,
  getGoogleBusinessRedirectUri,
  getGoogleBusinessWorkspaceForUser,
  googleOAuthStatesMatch,
  hashGoogleOAuthState,
} from '@/lib/googleBusinessWorkspace'
import {
  decryptGoogleBusinessToken,
  encryptGoogleBusinessToken,
} from '@/lib/googleBusinessTokens'

const BUSINESS_MANAGE_SCOPE = 'https://www.googleapis.com/auth/business.manage'

function redirectWithClearedState(path: string) {
  const response = NextResponse.redirect(new URL(path, BASE_URL))
  response.cookies.set(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/api/auth/google/callback',
  })
  response.cookies.set('google_oauth_state', '', { maxAge: 0, path: '/' })
  response.cookies.set('google_oauth_restaurant', '', { maxAge: 0, path: '/' })
  return response
}

export async function GET(request: NextRequest) {
  const availability = getGoogleBusinessAvailability()
  if (!availability.enabled) {
    return redirectWithClearedState(`/dashboard/settings?google_error=${availability.code}`)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email || !user.email_confirmed_at) {
    return redirectWithClearedState('/signin?next=%2Fdashboard%2Fsettings')
  }

  const receivedState = request.nextUrl.searchParams.get('state')
  const savedState = cookieStore.get(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE)?.value
  if (
    !receivedState
    || !savedState
    || receivedState.length > 256
    || !googleOAuthStatesMatch(receivedState, savedState)
  ) {
    return redirectWithClearedState('/dashboard/settings?google_error=state_mismatch')
  }

  const admin = getSupabaseAdmin()
  const { data: consumedRows, error: consumeError } = await admin.rpc(
    'consume_google_business_oauth_state',
    {
      p_state_hash: hashGoogleOAuthState(receivedState),
      p_auth_user_id: user.id,
    }
  )
  const consumed = Array.isArray(consumedRows) ? consumedRows[0] : consumedRows
  if (consumeError || !consumed?.workspace_id) {
    return redirectWithClearedState('/dashboard/settings?google_error=state_replayed')
  }

  const context = await getGoogleBusinessWorkspaceForUser(admin, user)
  if (!context || context.workspace.id !== consumed.workspace_id) {
    return redirectWithClearedState('/dashboard/settings?google_error=workspace_mismatch')
  }

  const oauthError = request.nextUrl.searchParams.get('error')
  if (oauthError) {
    return redirectWithClearedState('/dashboard/settings?google_error=access_denied')
  }

  const code = request.nextUrl.searchParams.get('code')
  if (!code || code.length > 4096) {
    return redirectWithClearedState('/dashboard/settings?google_error=invalid_callback')
  }

  let redirectUri: string
  try {
    redirectUri = getGoogleBusinessRedirectUri()
  } catch (error) {
    console.error('[Google Business OAuth] Invalid redirect configuration:', error)
    return redirectWithClearedState('/dashboard/settings?google_error=invalid_redirect')
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  })
  if (!tokenResponse.ok) {
    console.error('[Google Business OAuth] Token exchange failed with status', tokenResponse.status)
    return redirectWithClearedState('/dashboard/settings?google_error=token_exchange_failed')
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
  const scopes = tokenData.scope?.split(/\s+/).filter(Boolean) ?? []
  if (
    !tokenData.access_token
    || typeof tokenData.expires_in !== 'number'
    || !Number.isFinite(tokenData.expires_in)
    || tokenData.expires_in <= 0
    || !scopes.includes(BUSINESS_MANAGE_SCOPE)
  ) {
    return redirectWithClearedState('/dashboard/settings?google_error=missing_permissions')
  }

  let googleSubject: string | null = null
  let googleEmail: string | null = null
  try {
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: 'no-store',
    })
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json() as { sub?: string; email?: string }
      googleSubject = userInfo.sub ?? null
      googleEmail = userInfo.email?.toLowerCase() ?? null
    }
  } catch {
    // Fail closed below if Google identity verification is unavailable.
  }
  if (!googleSubject) {
    return redirectWithClearedState('/dashboard/settings?google_error=identity_lookup_failed')
  }

  const { data: existing } = await admin
    .from('google_business_connections')
    .select('google_subject, refresh_token_encrypted')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle<{ google_subject: string | null; refresh_token_encrypted: string | null }>()

  let refreshToken = tokenData.refresh_token
  if (
    !refreshToken
    && googleSubject
    && existing?.google_subject === googleSubject
    && existing.refresh_token_encrypted
  ) {
    try {
      refreshToken = decryptGoogleBusinessToken(existing.refresh_token_encrypted, 'refresh').plaintext
    } catch (error) {
      console.error('[Google Business OAuth] Existing refresh token could not be decrypted:', error)
    }
  }
  if (!refreshToken) {
    return redirectWithClearedState('/dashboard/settings?google_error=missing_refresh_token')
  }

  const now = new Date().toISOString()
  const { error: saveError } = await admin
    .from('google_business_connections')
    .upsert({
      workspace_id: context.workspace.id,
      connected_by_auth_user_id: user.id,
      google_subject: googleSubject,
      google_email: googleEmail,
      access_token_encrypted: encryptGoogleBusinessToken(tokenData.access_token, 'access'),
      refresh_token_encrypted: encryptGoogleBusinessToken(refreshToken, 'refresh'),
      token_expires_at: Date.now() + tokenData.expires_in * 1000,
      granted_scopes: scopes,
      status: 'active',
      last_error_code: null,
      last_error_at: null,
      connected_at: now,
      disconnected_at: null,
    }, { onConflict: 'workspace_id' })
  if (saveError) {
    console.error('[Google Business OAuth] Failed to save encrypted connection:', saveError.message)
    return redirectWithClearedState('/dashboard/settings?google_error=save_failed')
  }

  if (existing && existing.google_subject !== googleSubject) {
    const { error: unlinkError } = await admin
      .from('google_business_locations')
      .update({ is_active: false, disconnected_at: now })
      .eq('workspace_id', context.workspace.id)
    if (unlinkError) {
      console.error('[Google Business OAuth] Could not deactivate locations from the previous Google account:', unlinkError.message)
      return redirectWithClearedState('/dashboard/settings?google_error=save_failed')
    }
  }

  return redirectWithClearedState('/dashboard/settings?google_success=true')
}
