import {
  PLAYBOOK_CATEGORIES,
  cleanPlaybookText,
  parseProcedureSnapshot,
  type PlaybookPerson,
  type PlaybookProcedure,
  type PlaybookRole,
} from '@/lib/playbook'
import type { PlaybookAIProposal } from '@/lib/playbookAIContract'

export interface PlaybookFeedbackForAI {
  id: string
  rating: number
  text: string
  receivedAt: string
}

export type RawPlaybookProposal = {
  proposalKind: 'new_procedure' | 'change_procedure'
  procedureId: string | null
  problem: string
  proposedSnapshot: {
    title: string
    category: string
    description: string
    objective: string
    steps: string[]
    responsibleRoleId: string | null
    assignedPersonId: string | null
    status: 'draft' | 'active' | 'archived'
  }
  expectedBenefit: string
  priority: 'high' | 'medium' | 'low'
  rationale: string
  suggestedRoleId: string | null
  evidenceIds: string[]
}

export const PLAYBOOK_AI_INSTRUCTIONS =
  'You are an operations analyst helping a local business owner improve documented procedures. ' +
  'Use only the supplied feedback, roles, staff-directory IDs, and procedures. Find recurring operational problems supported by at least two distinct feedback records. ' +
  'Propose one to three practical procedure changes. Prefer changing an existing procedure when it clearly applies; otherwise propose a new one. ' +
  'Every evidence ID must exactly match an input feedback ID. Never invent customer evidence, employee identities, roles, responsibilities, or company policies. ' +
  'For an existing procedure, preserve its assignedPersonId exactly. For a new procedure, assignedPersonId must be null. ' +
  'Set proposed status to draft. Expected benefit must be a cautious, testable hypothesis and must not claim causation or statistical proof. ' +
  'Keep the owner in control: these are reviewable suggestions, never automatic policy changes. Use plain, category-appropriate language and no hype.'

export const PLAYBOOK_PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          proposalKind: { type: 'string', enum: ['new_procedure', 'change_procedure'] },
          procedureId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          problem: { type: 'string', minLength: 10, maxLength: 1000 },
          proposedSnapshot: {
            type: 'object',
            properties: {
              title: { type: 'string', minLength: 3, maxLength: 180 },
              category: { type: 'string', enum: PLAYBOOK_CATEGORIES },
              description: { type: 'string', maxLength: 2000 },
              objective: { type: 'string', maxLength: 1000 },
              steps: {
                type: 'array', minItems: 2, maxItems: 12,
                items: { type: 'string', minLength: 2, maxLength: 300 },
              },
              responsibleRoleId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              assignedPersonId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              status: { type: 'string', enum: ['draft', 'active', 'archived'] },
            },
            required: ['title', 'category', 'description', 'objective', 'steps', 'responsibleRoleId', 'assignedPersonId', 'status'],
            additionalProperties: false,
          },
          expectedBenefit: { type: 'string', minLength: 10, maxLength: 800 },
          priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          rationale: { type: 'string', minLength: 10, maxLength: 1000 },
          suggestedRoleId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          evidenceIds: {
            type: 'array', minItems: 2, maxItems: 20,
            items: { type: 'string' },
          },
        },
        required: [
          'proposalKind', 'procedureId', 'problem', 'proposedSnapshot', 'expectedBenefit',
          'priority', 'rationale', 'suggestedRoleId', 'evidenceIds',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['proposals'],
  additionalProperties: false,
} as const

export function buildPlaybookAIInput({
  feedback,
  procedures,
  roles,
  people,
  demo,
}: {
  feedback: PlaybookFeedbackForAI[]
  procedures: PlaybookProcedure[]
  roles: PlaybookRole[]
  people: PlaybookPerson[]
  demo: boolean
}) {
  return JSON.stringify({
    context: {
      dataset: demo ? 'fictional synthetic Playbook demo' : 'authorized first-party workspace feedback',
      evidenceNotice: 'Every evidence ID must exactly match an input record.',
      benefitNotice: 'Expected benefits are hypotheses, not proven outcomes.',
    },
    roles: roles.filter(role => role.active).map(role => ({
      id: role.id,
      name: role.name,
      department: role.department,
      responsibilities: role.responsibilities,
    })),
    staffDirectory: people.filter(person => person.active).map(person => ({
      id: person.id,
      jobTitle: person.job_title,
      department: person.department,
      roleId: person.role_id,
    })),
    procedures: procedures.map(procedure => ({
      id: procedure.id,
      title: procedure.title,
      category: procedure.category,
      description: procedure.description,
      objective: procedure.objective,
      steps: procedure.steps,
      responsibleRoleId: procedure.responsible_role_id,
      assignedPersonId: procedure.assigned_person_id,
      status: procedure.status,
      version: procedure.current_version,
    })),
    feedback: feedback.map(entry => ({
      id: entry.id,
      rating: entry.rating,
      text: entry.text,
      receivedAt: entry.receivedAt,
    })),
  })
}

export function normalizePlaybookAIProposals(
  raw: RawPlaybookProposal[],
  feedback: PlaybookFeedbackForAI[],
  procedures: PlaybookProcedure[],
  roles: PlaybookRole[],
  people: PlaybookPerson[],
  allowSyntheticIds: boolean,
): PlaybookAIProposal[] {
  const feedbackIds = new Set(feedback.map(item => item.id))
  const procedureById = new Map(procedures.map(item => [item.id, item]))
  const roleIds = new Set(roles.filter(item => item.active).map(item => item.id))
  const personIds = new Set(people.filter(item => item.active).map(item => item.id))

  return raw.map(item => {
    const procedure = item.procedureId ? procedureById.get(item.procedureId) : undefined
    if (item.proposalKind === 'change_procedure' && !procedure) {
      throw new Error('AI referenced a procedure outside the authorized workspace.')
    }
    if (item.proposalKind === 'new_procedure' && item.procedureId !== null) {
      throw new Error('AI returned an invalid new-procedure reference.')
    }

    const evidenceIds = [...new Set(item.evidenceIds.filter(id => feedbackIds.has(id)))]
    if (evidenceIds.length < 2 || evidenceIds.length !== new Set(item.evidenceIds).size) {
      throw new Error('AI proposal evidence was missing or unauthorized.')
    }
    if (item.suggestedRoleId !== null && !roleIds.has(item.suggestedRoleId)) {
      throw new Error('AI referenced an unauthorized role.')
    }

    const proposed = parseProcedureSnapshot({
      title: item.proposedSnapshot.title,
      category: item.proposedSnapshot.category,
      description: item.proposedSnapshot.description,
      objective: item.proposedSnapshot.objective,
      steps: item.proposedSnapshot.steps,
      responsible_role_id: item.proposedSnapshot.responsibleRoleId,
      assigned_person_id: item.proposedSnapshot.assignedPersonId,
      status: item.proposedSnapshot.status,
    }, { allowSyntheticIds })

    if (proposed.responsible_role_id !== null && !roleIds.has(proposed.responsible_role_id)) {
      throw new Error('AI proposed an unauthorized responsible role.')
    }
    if (proposed.assigned_person_id !== null && !personIds.has(proposed.assigned_person_id)) {
      throw new Error('AI proposed an unauthorized employee assignment.')
    }
    if (item.proposalKind === 'new_procedure' && proposed.assigned_person_id !== null) {
      throw new Error('AI cannot assign a named employee to a new procedure.')
    }
    if (procedure && proposed.assigned_person_id !== procedure.assigned_person_id) {
      throw new Error('AI cannot invent or change employee identities.')
    }

    const problem = cleanPlaybookText(item.problem, 2000)
    const expectedBenefit = cleanPlaybookText(item.expectedBenefit, 1200)
    const rationale = cleanPlaybookText(item.rationale, 2000)
    if (problem.length < 10 || expectedBenefit.length < 10 || rationale.length < 10) {
      throw new Error('AI proposal was incomplete.')
    }

    return {
      proposal_kind: item.proposalKind,
      procedure_id: item.procedureId,
      problem,
      proposed_snapshot: proposed,
      expected_benefit: expectedBenefit,
      priority: item.priority,
      rationale,
      suggested_role_id: item.suggestedRoleId,
      evidence_ids: evidenceIds,
    }
  })
}
