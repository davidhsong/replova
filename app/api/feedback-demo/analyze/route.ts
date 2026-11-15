import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { isSameOriginRequest } from '@/lib/accountOnboarding'
import { recordUsage } from '@/lib/apiBudget'
import {
  createDemoFeedbackEntries,
  FEEDBACK_DEMO_DATASET_VERSION,
} from '@/lib/feedbackDemo'
import { analyzeFeedbackDemo } from '@/lib/feedbackDemoAnalysis'
import { OPENAI_MODEL } from '@/lib/openai'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const WORKSPACE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT = 4

const globalRuns = globalThis as typeof globalThis & {
  __replovaFeedbackDemoRuns?: Set<string>
}
const activeRuns = globalRuns.__replovaFeedbackDemoRuns ?? new Set<string>()
globalRuns.__replovaFeedbackDemoRuns = activeRuns

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > 8_000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }

  let body: { workspaceId?: unknown; datasetVersion?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
  if (!WORKSPACE_ID_RE.test(workspaceId) || body.datasetVersion !== FEEDBACK_DEMO_DATASET_VERSION) {
    return NextResponse.json({ error: 'Invalid demo workspace request.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verify your email before running AI analysis.' }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 403 })
  }

  const { data: workspace, error: workspaceError } = await admin
    .from('business_workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('account_id', account.id)
    .eq('status', 'active')
    .maybeSingle<{ id: string }>()

  if (workspaceError) {
    console.error('[Feedback demo] Workspace lookup failed:', workspaceError.code)
    return NextResponse.json({ error: 'Unable to verify the demo workspace.' }, { status: 500 })
  }
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace access denied.' }, { status: 403 })
  }

  const userKey = createHash('sha256').update(user.id).digest('hex').slice(0, 20)
  const operation = `feedback_demo_analysis_${userKey}`
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error: rateError } = await admin
    .from('api_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('operation', operation)
    .gte('created_at', windowStart)

  if (rateError) {
    console.error('[Feedback demo] Rate-limit lookup failed:', rateError.code)
    return NextResponse.json({ error: 'AI analysis is temporarily unavailable.' }, { status: 503 })
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Analysis limit reached. Try again in about ten minutes.' },
      { status: 429, headers: { 'Retry-After': '600' } }
    )
  }
  if (activeRuns.has(user.id)) {
    return NextResponse.json({ error: 'An analysis is already running.' }, { status: 409 })
  }

  activeRuns.add(user.id)
  try {
    const entries = createDemoFeedbackEntries()
    const { analysis, inputTokens, outputTokens } = await analyzeFeedbackDemo(entries)
    await recordUsage(OPENAI_MODEL, operation, inputTokens, outputTokens)

    return NextResponse.json(
      { analysis, datasetVersion: FEEDBACK_DEMO_DATASET_VERSION },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (error) {
    console.error('[Feedback demo] Analysis failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Replova could not analyze the demo feedback. Try again.' }, { status: 502 })
  } finally {
    activeRuns.delete(user.id)
  }
}
