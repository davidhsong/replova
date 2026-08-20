const DEFAULT_PATH = '/dashboard'

/** Accept only same-site application paths, preserving query strings. */
export function safeRedirectPath(value: string | null | undefined, fallback = DEFAULT_PATH): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback

  try {
    const url = new URL(value, 'https://replova.invalid')
    if (url.origin !== 'https://replova.invalid') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
