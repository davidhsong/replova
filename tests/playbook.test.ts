import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createDemoFeedbackEntries } from '../lib/feedbackDemo'
import {
  buildPlaybookAIInput,
  normalizePlaybookAIProposals,
  type RawPlaybookProposal,
} from '../lib/playbookAICore'
import {
  applyPlaybookDemoAction,
  createInitialPlaybookDemoState,
  isPlaybookDemoState,
  PLAYBOOK_DEMO_LABEL,
} from '../lib/playbookDemo'

const workspaceId = '10000000-0000-4000-8000-000000000001'
const fixtureNow = new Date('2026-11-15T18:00:00.000Z')

function validRawProposal(state = createInitialPlaybookDemoState(workspaceId, fixtureNow)): RawPlaybookProposal {
  const procedure = state.procedures[0]
  return {
    proposalKind: 'change_procedure',
    procedureId: procedure.id,
    problem: 'Customers repeatedly report missed status update commitments.',
    proposedSnapshot: {
      title: procedure.title,
      category: procedure.category,
      description: 'Set, meet, and record every promised customer update time.',
      objective: procedure.objective,
      steps: [...procedure.steps, 'Review missed commitments at the next daily opening check.'],
      responsibleRoleId: procedure.responsible_role_id,
      assignedPersonId: procedure.assigned_person_id,
      status: 'draft',
    },
    expectedBenefit: 'Hypothesis: explicit update ownership may reduce avoidable status calls.',
    priority: 'high',
    rationale: 'Several synthetic records describe the same missed-update pattern.',
    suggestedRoleId: procedure.responsible_role_id,
    evidenceIds: ['feedback-001', 'feedback-002', 'feedback-004'],
  }
}

test('synthetic Playbook starts with labeled, isolated roles, people, procedures, versions, and tasks', () => {
  const state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  assert.equal(state.label, PLAYBOOK_DEMO_LABEL)
  assert.equal(state.roles.length, 4)
  assert.equal(state.people.length, 3)
  assert.equal(state.procedures.length, 3)
  assert.equal(state.versions.length, 3)
  assert.equal(state.tasks.length, 1)
  assert.ok(state.people.every(person => person.display_name.includes('(demo)')))
  assert.ok([...state.roles, ...state.people, ...state.procedures, ...state.versions, ...state.tasks]
    .every(record => record.workspace_id === workspaceId))
  assert.equal(isPlaybookDemoState(state, workspaceId), true)
  assert.equal(isPlaybookDemoState(state, '10000000-0000-4000-8000-000000000099'), false)
})

test('demo role and employee directory changes never create authentication identities', () => {
  let state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  state = applyPlaybookDemoAction(state, 'role.create', {
    name: 'Customer Support', department: 'Customer Care', responsibilities: 'Own customer follow-up.',
  }, fixtureNow)
  const role = state.roles.find(item => item.name === 'Customer Support')
  assert.ok(role)
  state = applyPlaybookDemoAction(state, 'person.create', {
    display_name: 'Taylor Brooks (demo)', job_title: 'Support Specialist', department: 'Customer Care', role_id: role.id,
  }, fixtureNow)
  const person = state.people.find(item => item.display_name === 'Taylor Brooks (demo)')
  assert.ok(person)
  assert.equal(person.role_id, role.id)
  const demoSource = readFileSync('lib/playbookDemo.ts', 'utf8')
  assert.doesNotMatch(demoSource, /auth\.admin|inviteUser|createUser|signUp/)
})

test('demo procedure create, activate, archive, and conflict handling append versions', () => {
  let state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  state = applyPlaybookDemoAction(state, 'procedure.create', {
    snapshot: {
      title: 'Complaint callback procedure', category: 'Complaint Resolution',
      description: 'Return customer complaint calls consistently.', objective: 'Provide a clear recovery owner.',
      steps: ['Log the complaint.', 'Assign a callback owner.'], responsible_role_id: 'demo-role-owner',
      assigned_person_id: null, status: 'draft',
    },
    change_summary: 'Initial complaint callback draft',
  }, fixtureNow)
  const procedure = state.procedures.find(item => item.title === 'Complaint callback procedure')!
  assert.equal(procedure.current_version, 1)

  state = applyPlaybookDemoAction(state, 'procedure.update', {
    id: procedure.id, expected_lock_version: 1,
    snapshot: { ...procedure, status: 'active' },
    change_summary: 'Owner approved callback workflow',
  }, new Date('2026-11-15T19:00:00Z'))
  const active = state.procedures.find(item => item.id === procedure.id)!
  assert.equal(active.status, 'active')
  assert.equal(active.current_version, 2)
  assert.equal(state.versions.filter(version => version.procedure_id === procedure.id).length, 2)
  assert.throws(() => applyPlaybookDemoAction(state, 'procedure.update', {
    id: procedure.id, expected_lock_version: 1, snapshot: { ...active, status: 'archived' }, change_summary: 'Stale archive',
  }, fixtureNow), /changed/i)
})

test('AI input omits employee display names and normalization rejects invented evidence or identities', () => {
  const state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  const feedback = createDemoFeedbackEntries(fixtureNow).slice(0, 6).map(entry => ({
    id: entry.id, rating: entry.rating, text: entry.text, receivedAt: entry.receivedAt,
  }))
  const input = buildPlaybookAIInput({
    feedback, procedures: state.procedures, roles: state.roles, people: state.people, demo: true,
  })
  assert.doesNotMatch(input, /Maya Chen|Jonah Lee|Priya Shah/)
  assert.match(input, /fictional synthetic Playbook demo/)

  const normalized = normalizePlaybookAIProposals([validRawProposal(state)], feedback, state.procedures, state.roles, state.people, true)
  assert.equal(normalized.length, 1)
  assert.deepEqual(normalized[0].evidence_ids, ['feedback-001', 'feedback-002', 'feedback-004'])

  const inventedEvidence = validRawProposal(state)
  inventedEvidence.evidenceIds = ['feedback-001', 'feedback-002', 'fabricated-feedback']
  assert.throws(
    () => normalizePlaybookAIProposals([inventedEvidence], feedback, state.procedures, state.roles, state.people, true),
    /evidence was missing or unauthorized/,
  )
  const inventedPerson = validRawProposal(state)
  inventedPerson.proposedSnapshot.assignedPersonId = 'demo-person-invented'
  assert.throws(
    () => normalizePlaybookAIProposals([inventedPerson], feedback, state.procedures, state.roles, state.people, true),
    /unauthorized employee|invent or change employee/i,
  )
})

test('demo proposal requires edit or explicit approval before a separately applied version', () => {
  let state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  const feedback = createDemoFeedbackEntries(fixtureNow).slice(0, 6).map(entry => ({
    id: entry.id, rating: entry.rating, text: entry.text, receivedAt: entry.receivedAt,
  }))
  const proposal = normalizePlaybookAIProposals([validRawProposal(state)], feedback, state.procedures, state.roles, state.people, true)[0]
  state = applyPlaybookDemoAction(state, 'proposal.addMany', { proposals: [proposal], model: 'test-model' }, fixtureNow)
  let stored = state.proposals[0]
  const procedureBefore = state.procedures.find(item => item.id === stored.procedure_id)!
  assert.equal(stored.status, 'pending')
  assert.throws(() => applyPlaybookDemoAction(state, 'proposal.apply', {
    id: stored.id, expected_lock_version: stored.lock_version,
    expected_procedure_lock_version: procedureBefore.lock_version, change_summary: 'Must fail',
  }, fixtureNow), /Approve/)

  state = applyPlaybookDemoAction(state, 'proposal.review', {
    id: stored.id, expected_lock_version: stored.lock_version, review_action: 'edit',
    edits: { ...stored, rationale: 'Owner edited this rationale before approval.' },
  }, fixtureNow)
  stored = state.proposals[0]
  state = applyPlaybookDemoAction(state, 'proposal.review', {
    id: stored.id, expected_lock_version: stored.lock_version, review_action: 'approve', edits: null,
  }, fixtureNow)
  stored = state.proposals[0]
  assert.equal(stored.status, 'approved')
  assert.equal(state.procedures.find(item => item.id === stored.procedure_id)!.current_version, 1)

  state = applyPlaybookDemoAction(state, 'proposal.apply', {
    id: stored.id, expected_lock_version: stored.lock_version,
    expected_procedure_lock_version: procedureBefore.lock_version,
    change_summary: 'Owner approved reliable status update process',
  }, new Date('2026-11-15T20:00:00Z'))
  stored = state.proposals[0]
  assert.equal(stored.status, 'applied')
  assert.equal(state.procedures.find(item => item.id === stored.procedure_id)!.current_version, 2)
  assert.equal(state.versions.at(-1)?.source, 'ai_proposal')
  assert.equal(state.versions.at(-1)?.source_proposal_id, stored.id)
})

test('demo tasks link to procedures and update status without touching feedback-demo or real records', () => {
  let state = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  state = applyPlaybookDemoAction(state, 'task.create', {
    title: 'Train on estimate approval procedure', description: 'Review the active procedure at opening.',
    procedure_id: state.procedures[1].id, proposal_id: null, role_id: 'demo-role-advisor', person_id: null,
    priority: 'high', status: 'todo',
  }, fixtureNow)
  const task = state.tasks.find(item => item.title === 'Train on estimate approval procedure')!
  assert.equal(task.procedure_id, state.procedures[1].id)
  assert.equal(task.role_id, 'demo-role-advisor')
  state = applyPlaybookDemoAction(state, 'task.update', { id: task.id, status: 'done' }, fixtureNow)
  assert.equal(state.tasks.find(item => item.id === task.id)?.status, 'done')
  assert.ok(state.tasks.find(item => item.id === task.id)?.completed_at)
  assert.equal(createDemoFeedbackEntries(fixtureNow).length, 60)
})

test('reset is repeatable and clears generated state without crossing workspace boundaries', () => {
  const first = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  const changed = applyPlaybookDemoAction(first, 'role.create', { name: 'Temporary Demo Role', department: 'Demo' }, fixtureNow)
  assert.equal(changed.roles.length, first.roles.length + 1)
  const reset = createInitialPlaybookDemoState(workspaceId, fixtureNow)
  assert.deepEqual(reset, first)
  assert.equal(reset.roles.some(role => role.name === 'Temporary Demo Role'), false)
})

test('routes enforce verified workspace ownership, same-origin mutations, evidence lookup, and durable limits', () => {
  const access = readFileSync('lib/playbookAccess.ts', 'utf8')
  const api = readFileSync('app/api/playbook/route.ts', 'utf8')
  const suggest = readFileSync('app/api/playbook/suggest/route.ts', 'utf8')
  const demoSuggest = readFileSync('app/api/playbook/demo/suggest/route.ts', 'utf8')
  const rate = readFileSync('lib/playbookRateLimit.ts', 'utf8')
  assert.match(access, /isSameOriginRequest\(request\)/)
  assert.match(access, /supabase\.auth\.getUser\(\)/)
  assert.match(access, /user\.email_confirmed_at/)
  assert.match(access, /\.eq\('account_id', account\.id\)/)
  assert.match(access, /\.eq\('status', 'active'\)/)
  assert.match(api, /workspace_id/)
  assert.match(api, /p_actor_id: user\.id/g)
  assert.match(suggest, /p_actor_id: user\.id/)
  assert.doesNotMatch(api, /p_actor_id:\s*(?:body|payload)\./)
  assert.doesNotMatch(suggest, /p_actor_id:\s*body\./)
  assert.match(suggest, /\.in\('restaurant_id', locationIds\)/)
  assert.match(suggest, /playbook_create_ai_proposals/)
  assert.match(demoSuggest, /createDemoFeedbackEntries\(\)/)
  assert.match(rate, /playbook_reserve_ai_run/)
  assert.match(rate, /mode !== 'demo'/)
  assert.match(rate, /MISSING_RPC_CODES/)
  assert.match(rate, /\.from\('api_usage_log'\)/)
  assert.match(rate, /rate-limit-reservation/)
  assert.doesNotMatch(demoSuggest, /\.from\('playbook_/)
})

test('authenticated dashboard identity comes from the session and workspace, never QA fixtures', () => {
  const layout = readFileSync('app/dashboard/layout.tsx', 'utf8')
  const sidebar = readFileSync('app/dashboard/DashboardSidebar.tsx', 'utf8')
  const shell = readFileSync('components/dashboard/shell/DashboardAppShell.tsx', 'utf8')
  const authenticatedIdentitySurface = `${layout}\n${sidebar}\n${shell}`
  const demo = readFileSync('lib/playbookDemo.ts', 'utf8')

  assert.doesNotMatch(
    authenticatedIdentitySurface,
    /Maya Chen|maya@example\.com|Northstar Auto Care/,
  )
  assert.match(layout, /user\.user_metadata\?\.display_name/)
  assert.match(layout, /userEmail=\{user\.email!\}/)
  assert.match(layout, /restaurantName=\{activeRestaurant\.name\}/)
  assert.match(layout, /workspaceName=\{workspace\.name\}/)
  assert.match(demo, /Maya Chen \(demo\)/)
  assert.doesNotMatch(demo, /maya@example\.com|Northstar Auto Care/)
})

test('UI exposes only working Playbook actions, labels demo data, and includes responsive breakpoints', () => {
  const client = readFileSync('app/dashboard/playbook/PlaybookClient.tsx', 'utf8')
  const css = readFileSync('app/dashboard/playbook/Playbook.module.css', 'utf8')
  const sidebar = readFileSync('app/dashboard/DashboardSidebar.tsx', 'utf8')
  const layout = readFileSync('app/dashboard/layout.tsx', 'utf8')
  assert.match(client, /Suggest playbook improvements/)
  assert.match(client, /Approve proposal/)
  assert.match(client, /Apply as new version/)
  assert.match(client, /No login account was created/)
  assert.match(client, /Nothing can publish externally/)
  assert.match(client, /window\.localStorage/)
  assert.match(sidebar, /href: '\/dashboard\/playbook\/demo'/)
  assert.match(sidebar, /replova:playbook-review-count/)
  assert.match(client, /replova:playbook-review-count/)
  assert.match(client, /More procedure actions/)
  assert.doesNotMatch(client, />Real workspace</)
  assert.match(layout, /pathname\.startsWith\('\/dashboard\/playbook'\)/)
  assert.match(css, /@media \(max-width: 1100px\)/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /@media \(max-width: 500px\)/)
  assert.match(css, /overflow-x: auto/)
  assert.doesNotMatch(client, /post-reply|youtube\/replies\/publish|sync-reviews/)
})
