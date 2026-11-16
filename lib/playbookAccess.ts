import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { isSameOriginRequest } from '@/lib/accountOnboarding'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isUuid } from '@/lib/playbook'
import { createClient } from '@/utils/supabase/server'

export type PlaybookContext = {
  admin: ReturnType<typeof getSupabaseAdmin>
  user: { id: string; email?: string }
  workspace: { id: string; name: string }
}

type PlaybookAccessResult =
  | { ok: true; context: PlaybookContext }
  | { ok: false; response: NextResponse }

export async function authorizePlaybookRequest(
  request: Request,
  workspaceId: unknown,
  options: { mutation?: boolean } = {},
): Promise<PlaybookAccessResult> {
  if (options.mutation && !isSameOriginRequest(request)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }) }
  }
  if (!isUuid(workspaceId)) {
    return { ok: false, response: NextResponse.json({ error: 'Invalid workspace.' }, { status: 400 }) }
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }
  if (!user.email_confirmed_at) {
    return { ok: false, response: NextResponse.json({ error: 'Verify your email to use Playbook.' }, { status: 403 }) }
  }

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account) {
    return { ok: false, response: NextResponse.json({ error: 'Account not found.' }, { status: 403 }) }
  }

  const { data: workspace, error: workspaceError } = await admin
    .from('business_workspaces')
    .select('id, name')
    .eq('id', workspaceId)
    .eq('account_id', account.id)
    .eq('status', 'active')
    .maybeSingle<{ id: string; name: string }>()

  if (workspaceError) {
    console.error('[Playbook] Workspace authorization failed:', workspaceError.code)
    return { ok: false, response: NextResponse.json({ error: 'Unable to verify workspace access.' }, { status: 500 }) }
  }
  if (!workspace) {
    return { ok: false, response: NextResponse.json({ error: 'Workspace access denied.' }, { status: 403 }) }
  }

  return {
    ok: true,
    context: {
      admin,
      user: { id: user.id, email: user.email },
      workspace,
    },
  }
}
