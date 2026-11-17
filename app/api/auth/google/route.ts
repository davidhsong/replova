import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'
import { getGoogleBusinessAvailability } from '@/lib/googleBusinessFeature'
import {
  GOOGLE_BUSINESS_OAUTH_STATE_COOKIE,
  getGoogleBusinessRedirectUri,
  getGoogleBusinessWorkspaceForUser,
  hashGoogleOAuthState,
} from '@/lib/googleBusinessWorkspace'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.redirect(new URL('/signin?next=%2Fdashboard%2Fsettings', BASE_URL))
  }
  if (!user.email_confirmed_at) {
    return NextResponse.redirect(new URL('/dashboard/settings?google_error=email_unverified', BASE_URL))
  }

  const availability = getGoogleBusinessAvailability()
  if (!availability.enabled) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?google_error=${availability.code}`, BASE_URL)
    )
  }

  let redirectUri: string
  try {
    redirectUri = getGoogleBusinessRedirectUri()
  } catch (error) {
    console.error('[Google Business OAuth] Invalid redirect configuration:', error)
    return NextResponse.redirect(new URL('/dashboard/settings?google_error=invalid_redirect', BASE_URL))
  }

  const admin = getSupabaseAdmin()
  const context = await getGoogleBusinessWorkspaceForUser(admin, user)
  if (!context) {
    return NextResponse.redirect(new URL('/onboard/workspace', BASE_URL))
  }

  const state = randomBytes(32).toString('base64url')
  const stateHash = hashGoogleOAuthState(state)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
  const { error: stateError } = await admin
    .from('google_business_oauth_states')
    .insert({
      state_hash: stateHash,
      workspace_id: context.workspace.id,
      auth_user_id: user.id,
      expires_at: expiresAt,
    })
  if (stateError) {
    console.error('[Google Business OAuth] Failed to create state:', stateError.message)
    return NextResponse.redirect(new URL('/dashboard/settings?google_error=state_create_failed', BASE_URL))
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/business.manage',
    ].join(' '),
    access_type: 'offline',
    // Keep the Business Profile grant distinct from the optional YouTube grant,
    // even when both integrations share the existing Google OAuth client.
    include_granted_scopes: 'false',
    prompt: 'consent',
    state,
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
  response.cookies.set(GOOGLE_BUSINESS_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/api/auth/google/callback',
    priority: 'high',
  })
  return response
}
