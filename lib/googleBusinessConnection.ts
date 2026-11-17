import type { SupabaseClient } from '@supabase/supabase-js'
import {
  encryptGoogleBusinessToken,
  rotateGoogleBusinessTokenIfNeeded,
} from '@/lib/googleBusinessTokens'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REFRESH_WINDOW_MS = 5 * 60 * 1000

export type GoogleBusinessConnectionRow = {
  id: string
  workspace_id: string
  google_subject: string | null
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  token_expires_at: number | null
  status: 'active' | 'reauthorization_required' | 'disconnected' | 'error'
}

export class GoogleBusinessAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly code: 'not_connected' | 'authorization_expired' | 'token_decryption_failed' | 'refresh_failed',
    public readonly status: number
  ) {
    super(message)
    this.name = 'GoogleBusinessAuthorizationError'
  }
}

export async function getValidGoogleBusinessAccessToken(
  connection: GoogleBusinessConnectionRow,
  admin: SupabaseClient,
  options: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}
): Promise<string> {
  if (
    connection.status !== 'active'
    || !connection.access_token_encrypted
    || !connection.refresh_token_encrypted
    || !connection.token_expires_at
  ) {
    throw new GoogleBusinessAuthorizationError(
      'Google Business Profile is not connected.',
      'not_connected',
      401
    )
  }

  let access: ReturnType<typeof rotateGoogleBusinessTokenIfNeeded>
  let refresh: ReturnType<typeof rotateGoogleBusinessTokenIfNeeded>
  try {
    access = rotateGoogleBusinessTokenIfNeeded(connection.access_token_encrypted, 'access')
    refresh = rotateGoogleBusinessTokenIfNeeded(connection.refresh_token_encrypted, 'refresh')
  } catch (error) {
    console.error('[Google Business OAuth] Token decryption failed:', error)
    await admin
      .from('google_business_connections')
      .update({
        status: 'error',
        last_error_code: 'token_decryption_failed',
        last_error_at: new Date().toISOString(),
      })
      .eq('id', connection.id)
    throw new GoogleBusinessAuthorizationError(
      'Stored Google credentials could not be read. Reconnect Google Business Profile.',
      'token_decryption_failed',
      500
    )
  }

  const shouldRefresh = Date.now() >= connection.token_expires_at - REFRESH_WINDOW_MS
  if (!shouldRefresh) {
    if (access.rotated || refresh.rotated) {
      const { error } = await admin
        .from('google_business_connections')
        .update({
          access_token_encrypted: access.encrypted,
          refresh_token_encrypted: refresh.encrypted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
      if (error) throw error
    }
    return access.plaintext
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refresh.plaintext,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: options.signal,
  })

  if (!response.ok) {
    const authorizationExpired = response.status >= 400 && response.status < 500
    await admin
      .from('google_business_connections')
      .update({
        // Keep transient refresh failures retryable. Only an OAuth 4xx marks
        // the grant as requiring explicit reauthorization.
        status: authorizationExpired ? 'reauthorization_required' : 'active',
        ...(authorizationExpired ? { access_token_encrypted: null } : {}),
        last_error_code: authorizationExpired ? 'authorization_expired' : 'token_refresh_failed',
        last_error_at: new Date().toISOString(),
      })
      .eq('id', connection.id)

    throw new GoogleBusinessAuthorizationError(
      authorizationExpired
        ? 'Google authorization expired or was revoked. Reconnect Google Business Profile.'
        : 'Google authorization could not be refreshed. Try again shortly.',
      authorizationExpired ? 'authorization_expired' : 'refresh_failed',
      authorizationExpired ? 401 : 502
    )
  }

  const tokenData = await response.json() as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
  if (
    !tokenData.access_token
    || typeof tokenData.expires_in !== 'number'
    || !Number.isFinite(tokenData.expires_in)
    || tokenData.expires_in <= 0
  ) {
    throw new GoogleBusinessAuthorizationError(
      'Google returned an incomplete token refresh response.',
      'refresh_failed',
      502
    )
  }

  const refreshedAccess = encryptGoogleBusinessToken(tokenData.access_token, 'access')
  const refreshedRefresh = tokenData.refresh_token
    ? encryptGoogleBusinessToken(tokenData.refresh_token, 'refresh')
    : refresh.encrypted
  const expiresAt = Date.now() + tokenData.expires_in * 1000
  const scopes = tokenData.scope?.split(/\s+/).filter(Boolean)

  const { error } = await admin
    .from('google_business_connections')
    .update({
      access_token_encrypted: refreshedAccess,
      refresh_token_encrypted: refreshedRefresh,
      token_expires_at: expiresAt,
      status: 'active',
      ...(scopes?.length ? { granted_scopes: scopes } : {}),
      refreshed_at: new Date().toISOString(),
      last_error_code: null,
      last_error_at: null,
    })
    .eq('id', connection.id)
  if (error) throw error

  return tokenData.access_token
}

