import { getSupabaseAdmin } from '@/lib/supabase'

export type Plan = 'starter' | 'growth' | 'agency'

export const PLAN_LIMITS = {
  starter: { locations: 1,  competitors: 3,  sentiment: false, scores: false, pdfReports: false, persona: false, whitelabel: false },
  growth:  { locations: 5,  competitors: 5,  sentiment: true,  scores: true,  pdfReports: true,  persona: false, whitelabel: false },
  agency:  { locations: 15, competitors: 10, sentiment: true,  scores: true,  pdfReports: true,  persona: true,  whitelabel: true  },
} as const

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan]
}

export function hasCompetitorTracking(plan: Plan): boolean {
  return plan === 'growth' || plan === 'agency'
}

export async function getAccountForEmail(
  email: string,
  admin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data } = await admin
    .from('accounts')
    .select('*')
    .eq('owner_email', email)
    .maybeSingle()
  return data
}
