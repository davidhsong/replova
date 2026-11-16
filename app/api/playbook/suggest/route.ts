import { NextRequest, NextResponse } from 'next/server'
import { recordUsage } from '@/lib/apiBudget'
import { analyzePlaybookImprovements } from '@/lib/playbookAI'
import { authorizePlaybookRequest } from '@/lib/playbookAccess'
import {
  beginLocalPlaybookRun,
  endLocalPlaybookRun,
  playbookRunKey,
  reservePlaybookAIRun,
} from '@/lib/playbookRateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 8_000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }
  let body: { workspaceId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const access = await authorizePlaybookRequest(request, body.workspaceId, { mutation: true })
  if (!access.ok) return access.response
  const { admin, user, workspace } = access.context
  const runKey = playbookRunKey(user.id, workspace.id, 'real')
  if (!beginLocalPlaybookRun(runKey)) {
    return NextResponse.json({ error: 'A Playbook analysis is already running.' }, { status: 409 })
  }

  try {
    const allowed = await reservePlaybookAIRun(admin, user.id, workspace.id, 'real')
    if (!allowed) {
      return NextResponse.json(
        { error: 'Playbook analysis limit reached. Try again in about ten minutes.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      )
    }

    const [rolesResult, peopleResult, proceduresResult, locationsResult] = await Promise.all([
      admin.from('playbook_roles').select('id, workspace_id, name, department, responsibilities, active, created_at, updated_at').eq('workspace_id', workspace.id),
      admin.from('playbook_people').select('id, workspace_id, display_name, job_title, department, responsibilities, role_id, active, created_at, updated_at').eq('workspace_id', workspace.id),
      admin.from('playbook_procedures').select('id, workspace_id, title, category, description, objective, steps, responsible_role_id, assigned_person_id, status, current_version, lock_version, created_at, updated_at').eq('workspace_id', workspace.id),
      admin.from('restaurants').select('id').eq('workspace_id', workspace.id),
    ])
    const lookupError = rolesResult.error ?? peopleResult.error ?? proceduresResult.error ?? locationsResult.error
    if (lookupError) throw lookupError
    const locationIds = (locationsResult.data ?? []).map(location => location.id)
    if (locationIds.length === 0) {
      return NextResponse.json({ error: 'Connect or add a location with authorized feedback before requesting suggestions.' }, { status: 422 })
    }
    const reviewsResult = await admin
      .from('reviews')
      .select('id, rating, review_text, review_timestamp')
      .in('restaurant_id', locationIds)
      .not('review_text', 'is', null)
      .order('review_timestamp', { ascending: false })
      .limit(60)
    if (reviewsResult.error) throw reviewsResult.error
    const feedback = (reviewsResult.data ?? [])
      .filter(review => typeof review.review_text === 'string' && review.review_text.trim().length > 0)
      .map(review => ({
        id: review.id,
        rating: review.rating,
        text: review.review_text as string,
        receivedAt: new Date(Number(review.review_timestamp)).toISOString(),
      }))
    if (feedback.length < 3) {
      return NextResponse.json({ error: 'At least three written feedback records are needed for a supported suggestion.' }, { status: 422 })
    }

    const analysis = await analyzePlaybookImprovements({
      feedback,
      procedures: proceduresResult.data ?? [],
      roles: rolesResult.data ?? [],
      people: peopleResult.data ?? [],
    })
    const { data: proposalIds, error: createError } = await admin.rpc('playbook_create_ai_proposals', {
      p_workspace_id: workspace.id,
      p_actor_id: user.id,
      p_model: analysis.model,
      p_proposals: analysis.proposals,
    })
    if (createError) throw createError
    await recordUsage(analysis.model, 'playbook_improvement_analysis', analysis.inputTokens, analysis.outputTokens)

    return NextResponse.json(
      { proposalIds, count: analysis.proposals.length },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('[Playbook] AI suggestion failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Replova could not generate supported Playbook suggestions. Try again.' }, { status: 502 })
  } finally {
    endLocalPlaybookRun(runKey)
  }
}
