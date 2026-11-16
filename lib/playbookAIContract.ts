import type { PlaybookProcedureSnapshot, PlaybookPriority } from '@/lib/playbook'

export interface PlaybookAIProposal {
  proposal_kind: 'new_procedure' | 'change_procedure'
  procedure_id: string | null
  problem: string
  proposed_snapshot: PlaybookProcedureSnapshot
  expected_benefit: string
  priority: PlaybookPriority
  rationale: string
  suggested_role_id: string | null
  evidence_ids: string[]
}
