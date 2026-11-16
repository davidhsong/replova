import 'server-only'

import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export async function getPlaybookPageContext() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account) redirect('/onboard/workspace')

  const { data: workspace } = await admin
    .from('business_workspaces')
    .select('id, name')
    .eq('account_id', account.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; name: string }>()
  if (!workspace) redirect('/onboard/workspace')

  return {
    workspace,
    demoStorageKey: `replova-playbook-demo-${createHash('sha256')
      .update(`${user.id}:${workspace.id}:v1`)
      .digest('hex')
      .slice(0, 24)}`,
  }
}
