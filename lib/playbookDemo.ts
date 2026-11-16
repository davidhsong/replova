import {
  cleanPlaybookText,
  parsePriority,
  parseProcedureSnapshot,
  parseTaskStatus,
  type PlaybookPerson,
  type PlaybookProcedure,
  type PlaybookRole,
  type PlaybookState,
  type PlaybookTask,
  type PlaybookVersion,
} from '@/lib/playbook'
import type { PlaybookAIProposal } from '@/lib/playbookAIContract'

export const PLAYBOOK_DEMO_VERSION = 1
export const PLAYBOOK_DEMO_LABEL = 'Synthetic Playbook demo'

export interface PlaybookDemoState extends PlaybookState {
  version: number
  resetAt: string
  label: typeof PLAYBOOK_DEMO_LABEL
}

function id(kind: string) {
  return `demo-${kind}-${crypto.randomUUID().slice(0, 8)}`
}

function baseRole(
  workspaceId: string,
  roleId: string,
  name: string,
  department: string,
  responsibilities: string,
  now: string,
): PlaybookRole {
  return {
    id: roleId, workspace_id: workspaceId, name, department, responsibilities,
    active: true, created_at: now, updated_at: now,
  }
}

function basePerson(
  workspaceId: string,
  personId: string,
  displayName: string,
  jobTitle: string,
  roleId: string,
  now: string,
): PlaybookPerson {
  return {
    id: personId, workspace_id: workspaceId, display_name: displayName,
    job_title: jobTitle, department: 'Service Operations', responsibilities: '',
    role_id: roleId, active: true, created_at: now, updated_at: now,
  }
}

function baseProcedure(
  workspaceId: string,
  procedure: Omit<PlaybookProcedure, 'workspace_id' | 'created_at' | 'updated_at' | 'lock_version' | 'current_version'>,
  now: string,
): PlaybookProcedure {
  return { ...procedure, workspace_id: workspaceId, created_at: now, updated_at: now, lock_version: 1, current_version: 1 }
}

export function createInitialPlaybookDemoState(workspaceId: string, date = new Date()): PlaybookDemoState {
  const now = date.toISOString()
  const roles = [
    baseRole(workspaceId, 'demo-role-owner', 'Shop Owner', 'Leadership', 'Approves procedures and removes operational blockers.', now),
    baseRole(workspaceId, 'demo-role-advisor', 'Service Advisor', 'Service Operations', 'Owns customer updates, estimates, and repair authorization.', now),
    baseRole(workspaceId, 'demo-role-technician', 'Lead Technician', 'Service Operations', 'Owns technical quality checks and repair handoffs.', now),
    baseRole(workspaceId, 'demo-role-frontdesk', 'Front Desk', 'Customer Care', 'Owns scheduling and arrival expectations.', now),
  ]
  const people = [
    basePerson(workspaceId, 'demo-person-maya', 'Maya Chen (demo)', 'Shop Owner', 'demo-role-owner', now),
    basePerson(workspaceId, 'demo-person-jonah', 'Jonah Lee (demo)', 'Service Advisor', 'demo-role-advisor', now),
    basePerson(workspaceId, 'demo-person-priya', 'Priya Shah (demo)', 'Lead Technician', 'demo-role-technician', now),
  ]
  const procedures = [
    baseProcedure(workspaceId, {
      id: 'demo-procedure-status-updates',
      title: 'Repair status updates',
      category: 'Customer Communication',
      description: 'Set a clear next-update time for every open repair order.',
      objective: 'Give customers a reliable point of contact and prevent avoidable status calls.',
      steps: [
        'Record the next promised update time at check-in.',
        'Contact the customer by that time even when there is no material change.',
        'Log the update and the next commitment on the repair order.',
      ],
      responsible_role_id: 'demo-role-advisor',
      assigned_person_id: 'demo-person-jonah',
      status: 'active',
    }, now),
    baseProcedure(workspaceId, {
      id: 'demo-procedure-estimate-approval',
      title: 'Estimate and added-work approval',
      category: 'Billing & Estimates',
      description: 'Present complete estimates and record customer authorization before added work begins.',
      objective: 'Make every approved amount and optional item clear before work starts.',
      steps: [
        'Show parts, labor, fees, taxes, and diagnostic charges as separate lines.',
        'Explain optional work and its effect on the total.',
        'Record approval before beginning added work.',
      ],
      responsible_role_id: 'demo-role-advisor',
      assigned_person_id: null,
      status: 'active',
    }, now),
    baseProcedure(workspaceId, {
      id: 'demo-procedure-final-check',
      title: 'Vehicle pickup quality check',
      category: 'Quality Control',
      description: 'Complete a consistent handoff check before notifying the customer.',
      objective: 'Return each vehicle clean, complete, and ready for pickup.',
      steps: [
        'Remove protective materials and inspect the work area.',
        'Clean the steering wheel and driver door contact points.',
        'Restore the driver seat and confirm no loose items remain.',
      ],
      responsible_role_id: 'demo-role-technician',
      assigned_person_id: 'demo-person-priya',
      status: 'draft',
    }, now),
  ]
  const versions: PlaybookVersion[] = procedures.map(procedure => ({
    id: `demo-version-${procedure.id.replace('demo-procedure-', '')}-1`,
    workspace_id: workspaceId,
    procedure_id: procedure.id,
    version_number: 1,
    snapshot: {
      title: procedure.title, category: procedure.category, description: procedure.description,
      objective: procedure.objective, steps: [...procedure.steps],
      responsible_role_id: procedure.responsible_role_id,
      assigned_person_id: procedure.assigned_person_id, status: procedure.status,
    },
    change_summary: 'Initial synthetic demo procedure',
    source: 'manual', source_proposal_id: null, created_by: null,
    approved_by: procedure.status === 'active' ? 'demo-owner' : null, created_at: now,
  }))
  const tasks: PlaybookTask[] = [{
    id: 'demo-task-status-pilot', workspace_id: workspaceId,
    procedure_id: 'demo-procedure-status-updates', proposal_id: null,
    title: 'Pilot the next-update checkpoint on every open repair order',
    description: 'Use the procedure for one week and review missed updates with the service advisor role.',
    role_id: 'demo-role-advisor', person_id: null, priority: 'high', status: 'in_progress',
    due_date: null, created_at: now, updated_at: now, completed_at: null,
  }]

  return {
    version: PLAYBOOK_DEMO_VERSION,
    resetAt: now,
    label: PLAYBOOK_DEMO_LABEL,
    roles,
    people,
    procedures,
    versions,
    proposals: [],
    tasks,
  }
}

export function isPlaybookDemoState(value: unknown, workspaceId: string): value is PlaybookDemoState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<PlaybookDemoState>
  return state.version === PLAYBOOK_DEMO_VERSION
    && state.label === PLAYBOOK_DEMO_LABEL
    && typeof state.resetAt === 'string'
    && Array.isArray(state.roles)
    && Array.isArray(state.people)
    && Array.isArray(state.procedures)
    && Array.isArray(state.versions)
    && Array.isArray(state.proposals)
    && Array.isArray(state.tasks)
    && [...state.roles, ...state.people, ...state.procedures, ...state.versions, ...state.proposals, ...state.tasks]
      .every(record => record && record.workspace_id === workspaceId)
}

export type DemoAction =
  | 'role.create' | 'role.update'
  | 'person.create' | 'person.update'
  | 'procedure.create' | 'procedure.update'
  | 'proposal.addMany' | 'proposal.review' | 'proposal.apply'
  | 'task.create' | 'task.update'

export function applyPlaybookDemoAction(
  source: PlaybookDemoState,
  action: DemoAction,
  payload: Record<string, unknown>,
  date = new Date(),
): PlaybookDemoState {
  const state = structuredClone(source)
  const now = date.toISOString()

  if (action === 'role.create') {
    const name = cleanPlaybookText(payload.name, 120)
    const department = cleanPlaybookText(payload.department, 100)
    if (name.length < 2 || department.length < 2) throw new Error('Role name and department are required.')
    if (state.roles.some(role => role.active && role.name.toLowerCase() === name.toLowerCase())) throw new Error('An active role already uses that name.')
    state.roles.push(baseRole(state.roles[0]?.workspace_id ?? '', id('role'), name, department, cleanPlaybookText(payload.responsibilities, 2000), now))
  } else if (action === 'role.update') {
    const role = state.roles.find(item => item.id === payload.id)
    if (!role) throw new Error('Role not found.')
    if (typeof payload.name === 'string') role.name = cleanPlaybookText(payload.name, 120)
    if (typeof payload.department === 'string') role.department = cleanPlaybookText(payload.department, 100)
    if (typeof payload.responsibilities === 'string') role.responsibilities = cleanPlaybookText(payload.responsibilities, 2000)
    if (typeof payload.active === 'boolean') role.active = payload.active
    role.updated_at = now
  } else if (action === 'person.create') {
    const displayName = cleanPlaybookText(payload.display_name, 120)
    const jobTitle = cleanPlaybookText(payload.job_title, 120)
    const department = cleanPlaybookText(payload.department, 100)
    const roleId = typeof payload.role_id === 'string' && state.roles.some(role => role.id === payload.role_id) ? payload.role_id : null
    if (displayName.length < 2 || jobTitle.length < 2 || department.length < 2) throw new Error('Name, job title, and department are required.')
    state.people.push({
      id: id('person'), workspace_id: state.roles[0]?.workspace_id ?? '', display_name: displayName,
      job_title: jobTitle, department, responsibilities: cleanPlaybookText(payload.responsibilities, 2000),
      role_id: roleId, active: true, created_at: now, updated_at: now,
    })
  } else if (action === 'person.update') {
    const person = state.people.find(item => item.id === payload.id)
    if (!person) throw new Error('Employee not found.')
    if (typeof payload.display_name === 'string') person.display_name = cleanPlaybookText(payload.display_name, 120)
    if (typeof payload.job_title === 'string') person.job_title = cleanPlaybookText(payload.job_title, 120)
    if (typeof payload.department === 'string') person.department = cleanPlaybookText(payload.department, 100)
    if (typeof payload.responsibilities === 'string') person.responsibilities = cleanPlaybookText(payload.responsibilities, 2000)
    if (payload.role_id === null || typeof payload.role_id === 'string') person.role_id = payload.role_id as string | null
    if (typeof payload.active === 'boolean') person.active = payload.active
    person.updated_at = now
  } else if (action === 'procedure.create') {
    const snapshot = parseProcedureSnapshot(payload.snapshot, { allowSyntheticIds: true })
    const procedureId = id('procedure')
    const procedure = baseProcedure(state.roles[0]?.workspace_id ?? '', { id: procedureId, ...snapshot }, now)
    state.procedures.push(procedure)
    state.versions.push({
      id: id('version'), workspace_id: procedure.workspace_id, procedure_id: procedureId, version_number: 1,
      snapshot, change_summary: cleanPlaybookText(payload.change_summary, 1000) || 'Initial demo procedure',
      source: 'manual', source_proposal_id: null, created_by: null,
      approved_by: snapshot.status === 'active' ? 'demo-owner' : null, created_at: now,
    })
  } else if (action === 'procedure.update') {
    const procedure = state.procedures.find(item => item.id === payload.id)
    if (!procedure) throw new Error('Procedure not found.')
    if (procedure.lock_version !== Number(payload.expected_lock_version)) throw new Error('This procedure changed. Reload and try again.')
    const snapshot = parseProcedureSnapshot(payload.snapshot, { allowSyntheticIds: true })
    Object.assign(procedure, snapshot, {
      current_version: procedure.current_version + 1,
      lock_version: procedure.lock_version + 1,
      updated_at: now,
    })
    state.versions.push({
      id: id('version'), workspace_id: procedure.workspace_id, procedure_id: procedure.id,
      version_number: procedure.current_version, snapshot,
      change_summary: cleanPlaybookText(payload.change_summary, 1000) || 'Owner updated demo procedure',
      source: 'manual', source_proposal_id: null, created_by: null,
      approved_by: snapshot.status === 'active' ? 'demo-owner' : null, created_at: now,
    })
  } else if (action === 'proposal.addMany') {
    const proposals = Array.isArray(payload.proposals) ? payload.proposals as PlaybookAIProposal[] : []
    for (const proposal of proposals) {
      state.proposals.push({
        id: id('proposal'), workspace_id: state.roles[0]?.workspace_id ?? '',
        procedure_id: proposal.procedure_id, proposal_kind: proposal.proposal_kind,
        problem: proposal.problem, proposed_snapshot: proposal.proposed_snapshot,
        expected_benefit: proposal.expected_benefit, priority: proposal.priority,
        rationale: proposal.rationale, suggested_role_id: proposal.suggested_role_id,
        status: 'pending', model: typeof payload.model === 'string' ? payload.model : 'OpenAI',
        lock_version: 1, approved_at: null, rejected_at: null, applied_version_id: null,
        created_at: now, updated_at: now,
        evidence: proposal.evidence_ids.map(evidenceId => ({
          proposal_id: '', review_id: evidenceId, restaurant_id: 'demo-feedback-dataset',
          rating: 0, text: '', received_at: '',
        })),
      })
    }
  } else if (action === 'proposal.review') {
    const proposal = state.proposals.find(item => item.id === payload.id)
    if (!proposal) throw new Error('Proposal not found.')
    if (proposal.lock_version !== Number(payload.expected_lock_version)) throw new Error('This proposal changed. Reload and try again.')
    const reviewAction = payload.review_action
    if (reviewAction === 'edit') {
      if (proposal.status !== 'pending') throw new Error('Only pending proposals can be edited.')
      const edits = payload.edits as Record<string, unknown>
      proposal.problem = cleanPlaybookText(edits.problem, 2000) || proposal.problem
      proposal.expected_benefit = cleanPlaybookText(edits.expected_benefit, 1200) || proposal.expected_benefit
      proposal.rationale = cleanPlaybookText(edits.rationale, 2000) || proposal.rationale
      if (edits.priority) proposal.priority = parsePriority(edits.priority)
      if (edits.proposed_snapshot) proposal.proposed_snapshot = parseProcedureSnapshot(edits.proposed_snapshot, { allowSyntheticIds: true })
      if ('suggested_role_id' in edits) proposal.suggested_role_id = edits.suggested_role_id as string | null
    } else if (reviewAction === 'approve') {
      if (proposal.status !== 'pending') throw new Error('Only pending proposals can be approved.')
      proposal.status = 'approved'
      proposal.approved_at = now
    } else if (reviewAction === 'reject') {
      if (!['pending', 'approved'].includes(proposal.status)) throw new Error('Proposal cannot be rejected.')
      proposal.status = 'rejected'
      proposal.rejected_at = now
    } else throw new Error('Invalid proposal action.')
    proposal.lock_version += 1
    proposal.updated_at = now
  } else if (action === 'proposal.apply') {
    const proposal = state.proposals.find(item => item.id === payload.id)
    if (!proposal) throw new Error('Proposal not found.')
    if (proposal.status === 'applied') return state
    if (proposal.status !== 'approved') throw new Error('Approve the proposal before applying it.')
    if (proposal.lock_version !== Number(payload.expected_lock_version)) throw new Error('This proposal changed. Reload and try again.')
    const snapshot = { ...proposal.proposed_snapshot, status: 'active' as const }
    let procedure = proposal.procedure_id ? state.procedures.find(item => item.id === proposal.procedure_id) : undefined
    if (procedure) {
      if (procedure.lock_version !== Number(payload.expected_procedure_lock_version)) throw new Error('The procedure changed. Reload and review the proposal again.')
      Object.assign(procedure, snapshot, {
        current_version: procedure.current_version + 1,
        lock_version: procedure.lock_version + 1,
        updated_at: now,
      })
    } else {
      procedure = baseProcedure(state.roles[0]?.workspace_id ?? '', { id: id('procedure'), ...snapshot }, now)
      state.procedures.push(procedure)
      proposal.procedure_id = procedure.id
    }
    const versionId = id('version')
    state.versions.push({
      id: versionId, workspace_id: procedure.workspace_id, procedure_id: procedure.id,
      version_number: procedure.current_version, snapshot,
      change_summary: cleanPlaybookText(payload.change_summary, 1000) || 'Applied owner-approved AI proposal',
      source: 'ai_proposal', source_proposal_id: proposal.id, created_by: null,
      approved_by: 'demo-owner', created_at: now,
    })
    proposal.status = 'applied'
    proposal.applied_version_id = versionId
    proposal.lock_version += 1
    proposal.updated_at = now
  } else if (action === 'task.create') {
    const title = cleanPlaybookText(payload.title, 220)
    if (title.length < 3) throw new Error('Task title is required.')
    state.tasks.push({
      id: id('task'), workspace_id: state.roles[0]?.workspace_id ?? '',
      procedure_id: typeof payload.procedure_id === 'string' ? payload.procedure_id : null,
      proposal_id: typeof payload.proposal_id === 'string' ? payload.proposal_id : null,
      title, description: cleanPlaybookText(payload.description, 2000),
      role_id: typeof payload.role_id === 'string' ? payload.role_id : null,
      person_id: typeof payload.person_id === 'string' ? payload.person_id : null,
      priority: parsePriority(payload.priority), status: parseTaskStatus(payload.status),
      due_date: typeof payload.due_date === 'string' && payload.due_date ? payload.due_date : null,
      created_at: now, updated_at: now, completed_at: payload.status === 'done' ? now : null,
    })
  } else if (action === 'task.update') {
    const task = state.tasks.find(item => item.id === payload.id)
    if (!task) throw new Error('Task not found.')
    if (typeof payload.title === 'string') task.title = cleanPlaybookText(payload.title, 220)
    if (typeof payload.description === 'string') task.description = cleanPlaybookText(payload.description, 2000)
    if (payload.priority) task.priority = parsePriority(payload.priority)
    if (payload.status) {
      task.status = parseTaskStatus(payload.status)
      task.completed_at = task.status === 'done' ? now : null
    }
    if ('role_id' in payload) task.role_id = payload.role_id as string | null
    if ('person_id' in payload) task.person_id = payload.person_id as string | null
    task.updated_at = now
  }

  return state
}
