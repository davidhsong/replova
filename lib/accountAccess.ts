import 'server-only'

import type { User } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { Plan } from '@/lib/planLimits'

export type ReplovaAccount = {
  id: string
  owner_email: string
  auth_user_id: string | null
  plan: Plan
  stripe_customer_id: string | null
  terms_accepted_at: string | null
  created_at: string
}

export async function getAccountForAuthUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  user: Pick<User, 'id' | 'email'>
): Promise<ReplovaAccount | null> {
  const { data: accountById, error: idError } = await admin
    .from('accounts')
    .select('id, owner_email, auth_user_id, plan, stripe_customer_id, terms_accepted_at, created_at')
    .eq('auth_user_id', user.id)
    .maybeSingle<ReplovaAccount>()

  if (idError) throw idError
  if (accountById) return accountById
  if (!user.email) return null

  const { data: legacyAccount, error: emailError } = await admin
    .from('accounts')
    .select('id, owner_email, auth_user_id, plan, stripe_customer_id, terms_accepted_at, created_at')
    .eq('owner_email', user.email.trim().toLowerCase())
    .maybeSingle<ReplovaAccount>()

  if (emailError) throw emailError
  return legacyAccount
}
