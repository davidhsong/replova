import { safeRedirectPath } from '@/lib/safeRedirect'

export type AuthRedirectEnvironment = {
  NODE_ENV?: string
  NEXT_PUBLIC_BASE_URL?: string
  NEXT_PUBLIC_APP_URL?: string
  NEXT_PUBLIC_VERCEL_URL?: string
  NEXT_PUBLIC_VERCEL_BRANCH_URL?: string
  VERCEL_URL?: string
  VERCEL_BRANCH_URL?: string
  VERCEL_PROJECT_PRODUCTION_URL?: string
}

const PRODUCTION_ORIGINS = [
  'https://www.replova.app',
  'https://replova.app',
]

function configuredOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null

  try {
    const url = new URL(value.trim())
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.origin
  } catch {
    return null
  }
}

function vercelOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null

  try {
    const raw = value.trim()
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    if (url.pathname !== '/' || url.search || url.hash) return null
    if (url.hostname !== 'vercel.app' && !url.hostname.endsWith('.vercel.app')) return null
    return url.origin
  } catch {
    return null
  }
}

function exactRequestOrigin(value: string | null): string | null {
  if (!value) return null

  try {
    const url = new URL(value)
    if (url.origin !== value || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function trustedAuthOrigins(
  environment: AuthRedirectEnvironment = process.env
): ReadonlySet<string> {
  const origins = new Set(PRODUCTION_ORIGINS)

  for (const configured of [
    environment.NEXT_PUBLIC_BASE_URL,
    environment.NEXT_PUBLIC_APP_URL,
  ]) {
    const origin = configuredOrigin(configured)
    if (origin) origins.add(origin)
  }

  for (const vercel of [
    environment.VERCEL_URL,
    environment.VERCEL_BRANCH_URL,
    environment.VERCEL_PROJECT_PRODUCTION_URL,
    environment.NEXT_PUBLIC_VERCEL_URL,
    environment.NEXT_PUBLIC_VERCEL_BRANCH_URL,
  ]) {
    const origin = vercelOrigin(vercel)
    if (origin) origins.add(origin)
  }

  if (environment.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000')
    origins.add('http://127.0.0.1:3000')
  }

  return origins
}

/**
 * Resolve a browser-initiated authentication origin without trusting Host or
 * forwarded-host headers. The Origin header must match the request URL and an
 * origin derived from server configuration or Replova's canonical domains.
 */
export function resolveBrowserAuthOrigin(
  request: Request,
  environment: AuthRedirectEnvironment = process.env
): string | null {
  const browserOrigin = exactRequestOrigin(request.headers.get('origin'))
  if (!browserOrigin) return null

  let requestOrigin: string
  try {
    requestOrigin = new URL(request.url).origin
  } catch {
    return null
  }

  if (requestOrigin !== browserOrigin) return null
  return trustedAuthOrigins(environment).has(browserOrigin) ? browserOrigin : null
}

export function getAuthEmailRedirectTo(
  request: Request,
  nextPath: string,
  environment: AuthRedirectEnvironment = process.env
): string | null {
  const origin = resolveBrowserAuthOrigin(request, environment)
  if (!origin) return null

  const redirect = new URL('/signin', origin)
  redirect.searchParams.set('next', safeRedirectPath(nextPath))
  return redirect.toString()
}

/** Callback navigations do not include an Origin header, so accept the URL
 * origin only after matching it against the same server-controlled allowlist. */
export function getAuthCallbackRedirects(
  requestUrl: string,
  nextPath: string | null,
  environment: AuthRedirectEnvironment = process.env
): { success: URL; error: URL } | null {
  let origin: string
  try {
    origin = new URL(requestUrl).origin
  } catch {
    return null
  }

  if (!trustedAuthOrigins(environment).has(origin)) return null

  const success = new URL(safeRedirectPath(nextPath), origin)
  const error = new URL('/signin', origin)
  error.searchParams.set('error', 'invalid_link')
  return { success, error }
}
