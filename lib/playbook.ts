export const PLAYBOOK_CATEGORIES = [
  'Customer Communication',
  'Scheduling',
  'Service Delivery',
  'Quality Control',
  'Complaint Resolution',
  'Billing & Estimates',
  'Customer Follow-Up',
  'General Operations',
] as const

export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number]
export type PlaybookProcedureStatus = 'draft' | 'active' | 'archived'
export type PlaybookPriority = 'high' | 'medium' | 'low'
export type PlaybookTaskStatus = 'todo' | 'in_progress' | 'done'
export type PlaybookProposalStatus = 'pending' | 'approved' | 'rejected' | 'applied'

export interface PlaybookRole {
  id: string
  workspace_id: string
  name: string
  department: string
  responsibilities: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface PlaybookPerson {
  id: string
  workspace_id: string
  display_name: string
  job_title: string
  department: string
  responsibilities: string
  role_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface PlaybookProcedureSnapshot {
  title: string
  category: PlaybookCategory
  description: string
  objective: string
  steps: string[]
  responsible_role_id: string | null
  assigned_person_id: string | null
  status: PlaybookProcedureStatus
}

export interface PlaybookProcedure extends PlaybookProcedureSnapshot {
  id: string
  workspace_id: string
  current_version: number
  lock_version: number
  created_at: string
  updated_at: string
}

export interface PlaybookVersion {
  id: string
  workspace_id: string
  procedure_id: string
  version_number: number
  snapshot: PlaybookProcedureSnapshot
  change_summary: string
  source: 'manual' | 'ai_proposal' | 'restore'
  source_proposal_id: string | null
  created_by: string | null
  approved_by: string | null
  created_at: string
}

export interface PlaybookEvidence {
  proposal_id: string
  review_id: string
  restaurant_id: string
  rating: number
  text: string
  received_at: string
}

export interface PlaybookProposal {
  id: string
  workspace_id: string
  procedure_id: string | null
  proposal_kind: 'new_procedure' | 'change_procedure'
  problem: string
  proposed_snapshot: PlaybookProcedureSnapshot
  expected_benefit: string
  priority: PlaybookPriority
  rationale: string
  suggested_role_id: string | null
  status: PlaybookProposalStatus
  model: string
  lock_version: number
  approved_at: string | null
  rejected_at: string | null
  applied_version_id: string | null
  created_at: string
  updated_at: string
  evidence: PlaybookEvidence[]
}

export interface PlaybookTask {
  id: string
  workspace_id: string
  procedure_id: string | null
  proposal_id: string | null
  title: string
  description: string
  role_id: string | null
  person_id: string | null
  priority: PlaybookPriority
  status: PlaybookTaskStatus
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface PlaybookState {
  roles: PlaybookRole[]
  people: PlaybookPerson[]
  procedures: PlaybookProcedure[]
  versions: PlaybookVersion[]
  proposals: PlaybookProposal[]
  tasks: PlaybookTask[]
}

export const EMPTY_PLAYBOOK_STATE: PlaybookState = {
  roles: [],
  people: [],
  procedures: [],
  versions: [],
  proposals: [],
  tasks: [],
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function cleanPlaybookText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : ''
}

function nullableId(value: unknown, allowSyntheticIds: boolean): string | null {
  if (value === null || value === undefined || value === '') return null
  if (isUuid(value)) return value
  if (allowSyntheticIds && typeof value === 'string' && /^demo-[a-z0-9-]{2,80}$/.test(value)) return value
  throw new Error('Invalid related record.')
}

export function parseProcedureSnapshot(
  value: unknown,
  options: { allowSyntheticIds?: boolean } = {},
): PlaybookProcedureSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Procedure details are required.')
  const source = value as Record<string, unknown>
  const title = cleanPlaybookText(source.title, 180)
  const category = source.category
  const description = cleanPlaybookText(source.description, 4000)
  const objective = cleanPlaybookText(source.objective, 2000)
  const status = source.status
  const steps = Array.isArray(source.steps)
    ? source.steps.map(step => cleanPlaybookText(step, 500)).filter(Boolean).slice(0, 30)
    : []

  if (title.length < 3) throw new Error('Procedure title must be at least 3 characters.')
  if (!PLAYBOOK_CATEGORIES.includes(category as PlaybookCategory)) throw new Error('Choose a valid procedure category.')
  if (!['draft', 'active', 'archived'].includes(String(status))) throw new Error('Choose a valid procedure status.')
  if (steps.length === 0) throw new Error('Add at least one procedure step.')

  return {
    title,
    category: category as PlaybookCategory,
    description,
    objective,
    steps,
    responsible_role_id: nullableId(source.responsible_role_id, Boolean(options.allowSyntheticIds)),
    assigned_person_id: nullableId(source.assigned_person_id, Boolean(options.allowSyntheticIds)),
    status: status as PlaybookProcedureStatus,
  }
}

export function parsePriority(value: unknown): PlaybookPriority {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  throw new Error('Choose a valid priority.')
}

export function parseTaskStatus(value: unknown): PlaybookTaskStatus {
  if (value === 'todo' || value === 'in_progress' || value === 'done') return value
  throw new Error('Choose a valid task status.')
}

export function snapshotFromProcedure(procedure: PlaybookProcedure): PlaybookProcedureSnapshot {
  return {
    title: procedure.title,
    category: procedure.category,
    description: procedure.description,
    objective: procedure.objective,
    steps: [...procedure.steps],
    responsible_role_id: procedure.responsible_role_id,
    assigned_person_id: procedure.assigned_person_id,
    status: procedure.status,
  }
}

export function playbookCounts(state: PlaybookState) {
  return {
    activeProcedures: state.procedures.filter(item => item.status === 'active').length,
    draftProcedures: state.procedures.filter(item => item.status === 'draft').length,
    pendingProposals: state.proposals.filter(item => item.status === 'pending' || item.status === 'approved').length,
    openTasks: state.tasks.filter(item => item.status !== 'done').length,
  }
}
