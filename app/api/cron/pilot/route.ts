import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { getOpenAI, OPENAI_MODEL } from '@/lib/openai'
import { getSupabaseAdmin } from '@/lib/supabase'
import { analyzeNext } from '@/lib/pilot/analysis'
import { advanceSimulation } from '@/lib/pilot/evidenceRun'
import { advance } from '@/lib/pilot/worker'
import { checked } from '@/lib/pilot/access'
import type { Book } from '@/lib/pilot/workflow'
export const maxDuration = 120
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new Response('Unauthorized', { status: 401 })
  if (req.nextUrl.searchParams.has('check')) {
    return Response.json({
      environment: process.env.VERCEL_ENV,
      databaseOrigin: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin,
      model: OPENAI_MODEL,
      modelConfigured: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
      officialOrigin:
        Boolean(process.env.OPENAI_API_KEY) &&
        getOpenAI().baseURL.replace(/\/$/, '') === 'https://api.openai.com/v1',
      providerDisabled: process.env.PILOT_PROVIDER_LIVE !== 'true',
    })
  }
  const admin = getSupabaseAdmin()
  checked(
    await admin
      .from('tap_feedback')
      .update({ analysis_status: 'failed', lease: null })
      .eq('analysis_status', 'working')
      .gte('attempts', 6)
      .lt('next_attempt', new Date().toISOString()),
  )
  const due =
    checked(
      await admin
        .from('issue_playbooks')
        .select('*')
        .lte('next_work', new Date().toISOString())
        .order('next_work')
        .limit(6)
        .returns<Book[]>(),
    ) ?? []
  // Leave room for an in-flight model call (30s timeout) and the scheduler response.
  const deadline = Date.now() + 8_000
  async function drain() {
    let claimed = 0
    while (claimed < 24 && Date.now() < deadline) {
      const wave = await Promise.all(
        Array.from({ length: Math.min(4, 24 - claimed) }, () => analyzeNext()),
      )
      const count = wave.filter(Boolean).length
      if (!count) break
      claimed += count
    }
    return claimed
  }
  const simulations =
    checked(
      await admin
        .from('issue_playbooks')
        .select('id,location_id,restaurants!inner(active)')
        .eq('restaurants.active', true)
        .lte('simulation_due', new Date().toISOString())
        .order('simulation_due')
        .limit(6),
    ) ?? []
  const [, claimed] = await Promise.all([
    Promise.all(due.map(advance)),
    drain(),
    Promise.all(simulations.map((row) => advanceSimulation(row.id, row.location_id))),
  ])
  return Response.json({ due: due.length, claimed })
}
