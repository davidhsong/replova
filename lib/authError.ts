const EXPIRED_LINK_MESSAGE =
  'That sign-in link has expired or already been used. Request a new one and use the newest email.'

const INVALID_LINK_MESSAGE =
  'That sign-in link is invalid. Request a new one and use the newest email.'

function authParams(value: string, prefix: '?' | '#') {
  return new URLSearchParams(value.startsWith(prefix) ? value.slice(1) : value)
}

/**
 * Converts known Supabase auth errors into safe user-facing copy without
 * reflecting provider-controlled descriptions into the page.
 */
export function authLinkErrorMessage(search: string, hash: string) {
  const query = authParams(search, '?')
  if (query.get('error') === 'invalid_link') return EXPIRED_LINK_MESSAGE

  const fragment = authParams(hash, '#')
  const code = fragment.get('error_code')
  const error = fragment.get('error')

  if (code === 'otp_expired') return EXPIRED_LINK_MESSAGE
  if (error === 'access_denied' || code) return INVALID_LINK_MESSAGE
  return null
}
