import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  DEFAULT_TRIAL_PLAN,
  isSameOriginRequest,
  normalizeWorkspaceName,
} from '@/lib/accountOnboarding'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = createClient(await cookies())
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Sign in before creating a workspace.' }, { status: 401 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verify your email before creating a workspace.' }, { status: 403 })
  }

  let body: { name?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const name = normalizeWorkspaceName(body.name)
  if (!name) {
    return NextResponse.json(
      { error: 'Enter a business name between 2 and 200 characters.' },
      { status: 400 }
    )
  }
  const { data, error } = await getSupabaseAdmin().rpc(
    'provision_replova_account_workspace',
    {
      p_auth_user_id: user.id,
      p_verified_email: user.email,
      p_workspace_name: name,
      p_plan: DEFAULT_TRIAL_PLAN,
    }
  )

  if (error) {
    const conflict = /owned_by_another|identity_(?:conflict|ambiguous)|email_mismatch/i.test(error.message)
    console.error('[onboarding/workspace] provisioning failed:', error.message)
    return NextResponse.json(
      { error: conflict
        ? 'This account identity is already linked. Sign in with the original owner email or contact support.'
        : 'Unable to create your workspace. Please try again.' },
      { status: conflict ? 409 : 500 }
    )
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result?.account_id || !result?.workspace_id) {
    return NextResponse.json({ error: 'Workspace provisioning returned no result.' }, { status: 500 })
  }

  return NextResponse.json({
    accountId: result.account_id,
    workspaceId: result.workspace_id,
    created: result.workspace_created === true,
  })
}
