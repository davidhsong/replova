import 'server-only'

import type { getSupabaseAdmin } from '@/lib/supabase'
import type {
  PlaybookEvidence,
  PlaybookProposal,
  PlaybookState,
} from '@/lib/playbook'

type AdminClient = ReturnType<typeof getSupabaseAdmin>

function fail(error: { code?: string; message?: string } | null, label: string) {
  if (error) {
    console.error(`[Playbook] ${label}:`, error.code ?? error.message ?? 'database error')
    throw new Error(`Unable to load ${label}.`)
  }
}

export async function loadPlaybookState(admin: AdminClient, workspaceId: string): Promise<PlaybookState> {
  const [roles, people, procedures, versions, proposals, evidence, tasks] = await Promise.all([
    admin.from('playbook_roles').select('id, workspace_id, name, department, responsibilities, active, created_at, updated_at').eq('workspace_id', workspaceId).order('active', { ascending: false }).order('name'),
    admin.from('playbook_people').select('id, workspace_id, display_name, job_title, department, responsibilities, role_id, active, created_at, updated_at').eq('workspace_id', workspaceId).order('active', { ascending: false }).order('display_name'),
    admin.from('playbook_procedures').select('id, workspace_id, title, category, description, objective, steps, responsible_role_id, assigned_person_id, status, current_version, lock_version, created_at, updated_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
    admin.from('playbook_versions').select('id, workspace_id, procedure_id, version_number, snapshot, change_summary, source, source_proposal_id, created_by, approved_by, created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    admin.from('playbook_change_proposals').select('id, workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot, expected_benefit, priority, rationale, suggested_role_id, status, model, lock_version, approved_at, rejected_at, applied_version_id, created_at, updated_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    admin.from('playbook_proposal_evidence').select('proposal_id, review_id, restaurant_id').eq('workspace_id', workspaceId),
    admin.from('playbook_tasks').select('id, workspace_id, procedure_id, proposal_id, title, description, role_id, person_id, priority, status, due_date, created_at, updated_at, completed_at').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }),
  ])

  fail(roles.error, 'roles')
  fail(people.error, 'people')
  fail(procedures.error, 'procedures')
  fail(versions.error, 'version history')
  fail(proposals.error, 'suggested changes')
  fail(evidence.error, 'proposal evidence')
  fail(tasks.error, 'improvement tasks')

  const evidenceRows = (evidence.data ?? []) as Array<{ proposal_id: string; review_id: string; restaurant_id: string }>
  const reviewIds = [...new Set(evidenceRows.map(item => item.review_id))]
  let reviews: Array<{ id: string; rating: number; review_text: string | null; review_timestamp: number | string }> = []
  if (reviewIds.length > 0) {
    const reviewResult = await admin
      .from('reviews')
      .select('id, rating, review_text, review_timestamp')
      .in('id', reviewIds)
    fail(reviewResult.error, 'supporting feedback')
    reviews = reviewResult.data ?? []
  }
  const reviewById = new Map(reviews.map(review => [review.id, review]))
  const evidenceByProposal = new Map<string, PlaybookEvidence[]>()
  for (const link of evidenceRows) {
    const review = reviewById.get(link.review_id)
    if (!review) continue
    const item: PlaybookEvidence = {
      proposal_id: link.proposal_id,
      review_id: link.review_id,
      restaurant_id: link.restaurant_id,
      rating: review.rating,
      text: review.review_text ?? 'Rating-only feedback',
      received_at: new Date(Number(review.review_timestamp)).toISOString(),
    }
    evidenceByProposal.set(link.proposal_id, [...(evidenceByProposal.get(link.proposal_id) ?? []), item])
  }

  const proposalRows = (proposals.data ?? []) as Omit<PlaybookProposal, 'evidence'>[]
  return {
    roles: roles.data ?? [],
    people: people.data ?? [],
    procedures: procedures.data ?? [],
    versions: versions.data ?? [],
    proposals: proposalRows.map(proposal => ({
      ...proposal,
      evidence: evidenceByProposal.get(proposal.id) ?? [],
    })),
    tasks: tasks.data ?? [],
  } as PlaybookState
}
