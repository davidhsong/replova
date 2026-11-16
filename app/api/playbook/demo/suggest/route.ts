import { NextRequest, NextResponse } from 'next/server'
import { recordUsage } from '@/lib/apiBudget'
import { createDemoFeedbackEntries, FEEDBACK_DEMO_DATASET_VERSION } from '@/lib/feedbackDemo'
import { analyzePlaybookImprovements } from '@/lib/playbookAI'
import { authorizePlaybookRequest } from '@/lib/playbookAccess'
import { PLAYBOOK_DEMO_VERSION } from '@/lib/playbookDemo'
import {
  beginLocalPlaybookRun,
  endLocalPlaybookRun,
  playbookRunKey,
  reservePlaybookAIRun,
} from '@/lib/playbookRateLimit'
import type { PlaybookPerson, PlaybookProcedure, PlaybookRole } from '@/lib/playbook'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 80_000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }
  let body: {
    workspaceId?: unknown
    datasetVersion?: unknown
    demoVersion?: unknown
    roles?: unknown
    people?: unknown
    procedures?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (body.datasetVersion !== FEEDBACK_DEMO_DATASET_VERSION || body.demoVersion !== PLAYBOOK_DEMO_VERSION) {
    return NextResponse.json({ error: 'Demo data is out of date. Reset the demo and try again.' }, { status: 400 })
  }
  const access = await authorizePlaybookRequest(request, body.workspaceId, { mutation: true })
  if (!access.ok) return access.response
  const { admin, user, workspace } = access.context
  const roles = Array.isArray(body.roles) ? body.roles as PlaybookRole[] : []
  const people = Array.isArray(body.people) ? body.people as PlaybookPerson[] : []
  const procedures = Array.isArray(body.procedures) ? body.procedures as PlaybookProcedure[] : []
  const records = [...roles, ...people, ...procedures]
  if (roles.length > 30 || people.length > 100 || procedures.length > 100
    || records.some(record => !record || record.workspace_id !== workspace.id || !String(record.id).startsWith('demo-'))) {
    return NextResponse.json({ error: 'Invalid synthetic Playbook state.' }, { status: 400 })
  }
  const runKey = playbookRunKey(user.id, workspace.id, 'demo')
  if (!beginLocalPlaybookRun(runKey)) {
    return NextResponse.json({ error: 'A demo analysis is already running.' }, { status: 409 })
  }

  try {
    const allowed = await reservePlaybookAIRun(admin, user.id, workspace.id, 'demo')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Demo analysis limit reached. Try again in about ten minutes.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      )
    }
    const feedbackEntries = createDemoFeedbackEntries()
    const analysis = await analyzePlaybookImprovements({
      feedback: feedbackEntries.map(entry => ({
        id: entry.id,
        rating: entry.rating,
        text: entry.text,
        receivedAt: entry.receivedAt,
      })),
      procedures,
      roles,
      people,
      demo: true,
    })
    await recordUsage(analysis.model, 'playbook_demo_improvement_analysis', analysis.inputTokens, analysis.outputTokens)
    return NextResponse.json(
      { proposals: analysis.proposals, model: analysis.model },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[Playbook demo] AI suggestion failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Replova could not analyze the synthetic demo feedback. Try again.' }, { status: 502 })
  } finally {
    endLocalPlaybookRun(runKey)
  }
}
