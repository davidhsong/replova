import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase'

function normalizeAddress(value: string) {
  const match = value.match(/<([^>]+)>/)
  return (match?.[1] ?? value).trim().toLowerCase()
}

export function getCareerAdminEmails() {
  const configured = (process.env.CAREERS_ADMIN_EMAILS ?? '')
    .split(',')
    .map(normalizeAddress)
    .filter(Boolean)
  const destination = process.env.CAREERS_EMAIL
    ? [normalizeAddress(process.env.CAREERS_EMAIL)]
    : []
  return new Set([...configured, ...destination])
}

export async function isCareerAdminEmail(email: string | null | undefined) {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (getCareerAdminEmails().has(normalized)) return true

  const { data, error } = await getSupabaseAdmin()
    .from('career_admins')
    .select('email')
    .eq('email', normalized)
    .maybeSingle()

  if (error) {
    console.error('[careers/admin] authorization lookup failed:', error.code)
    return false
  }
  return Boolean(data)
}

