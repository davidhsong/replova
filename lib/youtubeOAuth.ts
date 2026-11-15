import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { BASE_URL } from './baseUrl'

const STATE_VERSION = 'v1'
const STATE_TTL_SECONDS = 10 * 60
const MAX_CLOCK_SKEW_SECONDS = 60

function oauthStateKey(): Buffer {
  const encoded = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  if (!encoded) throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY is not configured')

  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) {
    throw new Error('YOUTUBE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }
  return key
}

function stateSignature(unsignedState: string, userId: string, workspaceId: string): string {
  return createHmac('sha256', oauthStateKey())
    .update('replova-youtube-oauth-state\0', 'utf8')
    .update(unsignedState, 'utf8')
    .update('\0', 'utf8')
    .update(userId, 'utf8')
    .update('\0', 'utf8')
    .update(workspaceId, 'utf8')
    .digest('base64url')
}

export function createYouTubeOAuthState({
  userId,
  workspaceId,
  nowMs = Date.now(),
}: {
  userId: string
  workspaceId: string
  nowMs?: number
}): string {
  if (!userId || !workspaceId) throw new Error('YouTube OAuth state requires an owner and workspace')

  const issuedAt = Math.floor(nowMs / 1000)
  const expiresAt = issuedAt + STATE_TTL_SECONDS
  const nonce = randomBytes(32).toString('base64url')
  const unsignedState = [STATE_VERSION, nonce, issuedAt, expiresAt].join('.')
  return `${unsignedState}.${stateSignature(unsignedState, userId, workspaceId)}`
}

export function verifyYouTubeOAuthState({
  state,
  userId,
  workspaceId,
  nowMs = Date.now(),
}: {
  state: string
  userId: string
  workspaceId: string
  nowMs?: number
}): boolean {
  const [version, nonce, issuedAtValue, expiresAtValue, signature, extra] = state.split('.')
  if (
    version !== STATE_VERSION
    || !/^[A-Za-z0-9_-]{43}$/.test(nonce ?? '')
    || !/^\d{10}$/.test(issuedAtValue ?? '')
    || !/^\d{10}$/.test(expiresAtValue ?? '')
    || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? '')
    || extra
    || !userId
    || !workspaceId
  ) return false

  const issuedAt = Number(issuedAtValue)
  const expiresAt = Number(expiresAtValue)
  const now = Math.floor(nowMs / 1000)
  if (
    !Number.isSafeInteger(issuedAt)
    || !Number.isSafeInteger(expiresAt)
    || expiresAt - issuedAt !== STATE_TTL_SECONDS
    || issuedAt > now + MAX_CLOCK_SKEW_SECONDS
    || expiresAt <= now
  ) return false

  const unsignedState = [version, nonce, issuedAtValue, expiresAtValue].join('.')
  return youtubeOAuthStatesMatch(signature, stateSignature(unsignedState, userId, workspaceId))
}

export function youtubeOAuthStatesMatch(received: string, saved: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8')
  const savedBuffer = Buffer.from(saved, 'utf8')
  return receivedBuffer.length === savedBuffer.length
    && timingSafeEqual(receivedBuffer, savedBuffer)
}

export function getYouTubeRedirectUri(baseUrl = BASE_URL): string {
  const base = new URL(baseUrl)
  if (base.username || base.password || base.search || base.hash || !['', '/'].includes(base.pathname)) {
    throw new Error('NEXT_PUBLIC_BASE_URL is not a valid OAuth origin')
  }
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') {
    throw new Error('YouTube OAuth requires an HTTPS production origin')
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('YouTube OAuth origin must use HTTP or HTTPS')
  }
  return new URL('/api/auth/youtube/callback', base.origin).toString()
}

export function canReconnectYouTubeChannel(
  existingChannelId: string | null | undefined,
  authorizedChannelId: string
): boolean {
  return !existingChannelId || existingChannelId === authorizedChannelId
}
