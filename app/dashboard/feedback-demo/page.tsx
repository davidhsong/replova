import { createHash } from 'node:crypto'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'
import FeedbackDemoClient from './FeedbackDemoClient'

export const metadata: Metadata = {
  title: 'Feedback Operations Demo',
  robots: { index: false, follow: false, nocache: true },
}

export default async function FeedbackDemoPage() {
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

  const storageKey = `replova-feedback-demo-${createHash('sha256')
    .update(`${user.id}:${workspace.id}:v1`)
    .digest('hex')
    .slice(0, 24)}`

  return (
    <FeedbackDemoClient
      workspaceId={workspace.id}
      ownerWorkspaceName={workspace.name}
      storageKey={storageKey}
    />
  )
}
