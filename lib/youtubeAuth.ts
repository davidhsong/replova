import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const ENCRYPTION_VERSION = 'v1'
const REFRESH_WINDOW_MS = 5 * 60 * 1000

export type YouTubeConnectionTokenFields = {
  user_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string
  token_expires_at: number
}

function encryptionKey(): Buffer {
  const encoded = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  if (!encoded) throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY is not configured')

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }
  return key
}

export function encryptYouTubeToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [ENCRYPTION_VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptYouTubeToken(payload: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = payload.split('.')
  if (version !== ENCRYPTION_VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error('Invalid encrypted YouTube token')
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encodedIv, 'base64url'))
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export async function getValidYouTubeAccessToken(
  connection: YouTubeConnectionTokenFields,
  admin: SupabaseClient,
  options: { preserveConnectionOnRefreshFailure?: boolean; signal?: AbortSignal } = {}
): Promise<string | null> {
  if (Date.now() < connection.token_expires_at - REFRESH_WINDOW_MS) {
    try {
      return decryptYouTubeToken(connection.access_token_encrypted)
    } catch (error) {
      console.error('[YouTube OAuth] Failed to decrypt access token:', error)
      return null
    }
  }

  let refreshToken: string
  try {
    refreshToken = decryptYouTubeToken(connection.refresh_token_encrypted)
  } catch (error) {
    console.error('[YouTube OAuth] Failed to decrypt refresh token:', error)
    return null
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: options.signal,
  })

  if (!response.ok) {
    console.error(`[YouTube OAuth] Token refresh failed with status ${response.status}`)
    if (
      response.status >= 400 && response.status < 500
      && !options.preserveConnectionOnRefreshFailure
    ) {
      await admin.from('youtube_connections').delete().eq('user_id', connection.user_id)
    }
    return null
  }

  const data = await response.json() as { access_token?: string; expires_in?: number }
  if (!data.access_token || !data.expires_in) return null

  const tokenExpiresAt = Date.now() + data.expires_in * 1000
  const encryptedAccessToken = encryptYouTubeToken(data.access_token)
  const { error } = await admin
    .from('youtube_connections')
    .update({
      access_token_encrypted: encryptedAccessToken,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', connection.user_id)

  if (error) {
    console.error('[YouTube OAuth] Failed to persist refreshed token:', error.message)
    return null
  }
  return data.access_token
}
