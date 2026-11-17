import type { User } from '@supabase/supabase-js'
import { createHash, timingSafeEqual } from 'node:crypto'
import { BASE_URL } from '@/lib/baseUrl'
import { getAccountForAuthUser, type ReplovaAccount } from '@/lib/accountAccess'
import { getSupabaseAdmin } from '@/lib/supabase'

export const GOOGLE_BUSINESS_OAUTH_STATE_COOKIE = 'google_business_oauth_state'

export type GoogleBusinessWorkspaceContext = {
  account: ReplovaAccount
  workspace: { id: string; name: string }
}

export async function getGoogleBusinessWorkspaceForUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  user: Pick<User, 'id' | 'email' | 'email_confirmed_at'>
): Promise<GoogleBusinessWorkspaceContext | null> {
  if (!user.email || !user.email_confirmed_at) return null

  const account = await getAccountForAuthUser(admin, user)
  if (!account || account.auth_user_id !== user.id) return null

  const { data: workspace, error } = await admin
    .from('business_workspaces')
    .select('id, name')
    .eq('account_id', account.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>()

  if (error) throw error
  return workspace ? { account, workspace } : null
}

export function hashGoogleOAuthState(state: string): string {
  return createHash('sha256').update(state, 'utf8').digest('hex')
}

export function googleOAuthStatesMatch(received: string, saved: string): boolean {
  const receivedBuffer = Buffer.from(received, 'utf8')
  const savedBuffer = Buffer.from(saved, 'utf8')
  return receivedBuffer.length === savedBuffer.length
    && timingSafeEqual(receivedBuffer, savedBuffer)
}

export function getGoogleBusinessRedirectUri(): string {
  const base = new URL(BASE_URL)
  if (base.username || base.password || base.search || base.hash || !['', '/'].includes(base.pathname)) {
    throw new Error('NEXT_PUBLIC_BASE_URL is not a valid OAuth origin')
  }
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') {
    throw new Error('Google Business OAuth requires an HTTPS production origin')
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    throw new Error('Google Business OAuth origin must use HTTP or HTTPS')
  }
  return new URL('/api/auth/google/callback', base.origin).toString()
}

