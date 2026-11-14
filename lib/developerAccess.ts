import 'server-only'

function normalizeEmail(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] ?? value).trim().toLowerCase()
}

export function isDeveloperEmail(email: string | null | undefined): boolean {
  if (!email) return false

  const allowlist = (process.env.DEVELOPER_EMAILS ?? '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean)

  return new Set(allowlist).has(normalizeEmail(email))
}
