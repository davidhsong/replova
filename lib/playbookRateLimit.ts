import 'server-only'

import { createHash } from 'node:crypto'
import type { getSupabaseAdmin } from '@/lib/supabase'

const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 4
const MISSING_RPC_CODES = new Set(['PGRST202', '42883'])

const globalRuns = globalThis as typeof globalThis & { __replovaPlaybookRuns?: Set<string> }
const activeRuns = globalRuns.__replovaPlaybookRuns ?? new Set<string>()
globalRuns.__replovaPlaybookRuns = activeRuns

export function playbookRunKey(userId: string, workspaceId: string, mode: 'real' | 'demo') {
  return `${mode}:${userId}:${workspaceId}`
}

export function beginLocalPlaybookRun(key: string) {
  if (activeRuns.has(key)) return false
  activeRuns.add(key)
  return true
}

export function endLocalPlaybookRun(key: string) {
  activeRuns.delete(key)
}

export async function reservePlaybookAIRun(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  workspaceId: string,
  mode: 'real' | 'demo',
) {
  const hash = createHash('sha256').update(`${userId}:${workspaceId}`).digest('hex').slice(0, 32)
  const operation = `playbook_ai_limit_${mode}_${hash}`
  const { data, error } = await admin.rpc('playbook_reserve_ai_run', {
    p_operation: operation,
    p_window_start: new Date(Date.now() - WINDOW_MS).toISOString(),
    p_limit: LIMIT,
  })
  if (!error) return Boolean(data)

  // The synthetic demo is intentionally usable before migration 031. Keep the
  // atomic RPC as the primary limiter, but fall back to the existing migration
  // 008 usage log only when that RPC is genuinely absent. Real Playbook writes
  // still fail closed until the Playbook schema is installed.
  if (mode !== 'demo' || !MISSING_RPC_CODES.has(error.code ?? '')) throw error

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  const { count, error: countError } = await admin
    .from('api_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('operation', operation)
    .gte('created_at', windowStart)
  if (countError) throw countError
  if ((count ?? 0) >= LIMIT) return false

  const { error: reservationError } = await admin.from('api_usage_log').insert({
    model: 'rate-limit-reservation',
    operation,
    input_tokens: 0,
    output_tokens: 0,
    cost_usd: 0,
  })
  if (reservationError) throw reservationError
  return true
}
