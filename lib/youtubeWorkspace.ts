import 'server-only'

import type { User } from '@supabase/supabase-js'
import { getAccountForAuthUser, type ReplovaAccount } from './accountAccess'
import { getSupabaseAdmin } from './supabase'

export type YouTubeWorkspaceContext = {
  account: ReplovaAccount
  workspace: { id: string; name: string }
}

export async function getYouTubeWorkspaceForUser(
  admin: ReturnType<typeof getSupabaseAdmin>,
  user: Pick<User, 'id' | 'email' | 'email_confirmed_at'>
): Promise<YouTubeWorkspaceContext | null> {
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
