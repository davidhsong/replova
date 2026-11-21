// Included only in the dedicated staging Preview upload.
import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { getOpenAI, OPENAI_MODEL, type ModelReceipt } from '@/lib/openai'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checked } from '@/lib/pilot/access'
import { analyzeClaimed } from '@/lib/pilot/analysis'
import { isUuid } from '@/lib/playbook'

export const maxDuration = 60
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return new Response(null, { status: 401 })
  const ids = (process.env.PILOT_ACCEPTANCE_ENCOUNTERS || '').split(',')
  const location = process.env.PILOT_ACCEPTANCE_LOCATION
  const checks = {
    preview: process.env.VERCEL_ENV === 'preview',
    staging: process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://yhoblsunpmheyoqtdlvu.supabase.co',
    providerDisabled: process.env.PILOT_PROVIDER_LIVE === 'false',
    keyPresent: Boolean(process.env.OPENAI_API_KEY),
    requestedModel: process.env.OPENAI_MODEL === 'gpt-6-luna' && OPENAI_MODEL === 'gpt-6-luna',
    official: Boolean(process.env.OPENAI_API_KEY) && getOpenAI().baseURL.replace(/\/$/, '') === 'https://api.openai.com/v1',
    bounded: isUuid(location) && ids.length === 4 && new Set(ids).size === 4 && ids.every(isUuid),
  }
  const ok = Object.values(checks).every(Boolean)
  if (request.nextUrl.searchParams.has('check') || !ok)
    return Response.json({ checks }, { status: ok ? 200 : 503 })

  // The scheduler sends one ID at a time and stops on a provider error.
  const id = request.nextUrl.searchParams.get('encounter')
  if (!id || !ids.includes(id)) return new Response(null, { status: 400 })
  const row = checked(await getSupabaseAdmin().from('tap_feedback')
    .update({ attempts: 2, analysis_status: 'working', lease: randomUUID(), next_attempt: 'infinity' })
    .eq('id', id).eq('location_id', location).eq('analysis_status', 'failed')
    .eq('attempts', 1).eq('next_attempt', 'infinity').eq('is_test', false).neq('comment', '')
    .select('id,attempts,created_at,lease,comment').maybeSingle())
  if (!row) return Response.json({ encounter: id, outcome: 'ineligible' }, { status: 409 })
  const started = Date.now()
  let receipt: ModelReceipt | undefined
  let outcome = 'saved'
  let providerStatus: number | null = null
  let errorCode: string | null = null
  let errorRequestId: string | null = null
  try {
    const saved = await analyzeClaimed(row, 0, value => { receipt = value })
    if (!saved) outcome = 'lease_changed'
  } catch (error) {
    const e = error as { status?: number; code?: string; request_id?: string }
    providerStatus = typeof e.status === 'number' ? e.status : null
    errorCode = typeof e.code === 'string' && /^[a-z0-9_]{1,64}$/i.test(e.code) ? e.code : null
    errorRequestId = typeof e.request_id === 'string' && /^req_[\w-]+$/.test(e.request_id) ? e.request_id : null
    outcome = receipt ? 'output_rejected' : 'provider_error'
  }
  const result = { encounter: id, outcome, requestedModel: OPENAI_MODEL,
    queueWaitMs: started - Date.parse(row.created_at), providerStatus, errorCode,
    requestId: errorRequestId, ...receipt, attemptMs: Date.now() - started }
  console.info('pilot-model-acceptance', JSON.stringify(result))
  return Response.json(result, { status: outcome === 'provider_error' ? 502 : 200 })
}
