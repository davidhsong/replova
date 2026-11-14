import type { Plan } from '@/lib/planLimits'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Replova's existing no-card onboarding trial includes Growth features. This
// is a server policy, not a client-selected paid entitlement.
export const DEFAULT_TRIAL_PLAN: Plan = 'growth'

export function normalizeOnboardingEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !EMAIL_RE.test(email)) return null
  return email
}

export function normalizeWorkspaceName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 200) return null
  return name
}

export function isExistingAuthIdentityError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('already')
    || normalized.includes('registered')
    || normalized.includes('exists')
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}
