import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationSql = readFile(path.join(repoRoot, 'supabase', 'migrations', '031_business_playbook.sql'), 'utf8')

const ownerOne = '00000000-0000-4000-8000-000000000001'
const ownerTwo = '00000000-0000-4000-8000-000000000002'
const workspaceOne = '10000000-0000-4000-8000-000000000001'
const workspaceTwo = '10000000-0000-4000-8000-000000000002'
const restaurantOne = '20000000-0000-4000-8000-000000000001'
const restaurantTwo = '20000000-0000-4000-8000-000000000002'
const reviewOne = '30000000-0000-4000-8000-000000000001'
const reviewTwo = '30000000-0000-4000-8000-000000000002'

const baseSchema = `
  CREATE FUNCTION gen_random_uuid() RETURNS uuid
  LANGUAGE sql VOLATILE
  AS $$ SELECT md5(random()::text || clock_timestamp()::text)::uuid $$;

  CREATE SCHEMA auth;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN;

  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    email_confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email text UNIQUE NOT NULL,
    auth_user_id uuid REFERENCES auth.users(id),
    plan text NOT NULL DEFAULT 'growth',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE business_workspaces (
    id uuid PRIMARY KEY,
    account_id uuid NOT NULL REFERENCES accounts(id),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE restaurants (
    id uuid PRIMARY KEY,
    workspace_id uuid REFERENCES business_workspaces(id),
    name text NOT NULL,
    place_id text UNIQUE,
    owner_email text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE reviews (
    id uuid PRIMARY KEY,
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    author text,
    rating integer CHECK (rating BETWEEN 1 AND 5),
    review_text text,
    review_timestamp bigint,
    status text NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE api_usage_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    model text NOT NULL,
    operation text NOT NULL,
    input_tokens int NOT NULL DEFAULT 0,
    output_tokens int NOT NULL DEFAULT 0,
    cost_usd float NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
  );

  CREATE FUNCTION current_user_owns_replova_workspace(p_workspace_id uuid)
  RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

  INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
    ('${ownerOne}', 'one@example.com', now()),
    ('${ownerTwo}', 'two@example.com', now());
  INSERT INTO accounts (id, owner_email, auth_user_id) VALUES
    ('90000000-0000-4000-8000-000000000001', 'one@example.com', '${ownerOne}'),
    ('90000000-0000-4000-8000-000000000002', 'two@example.com', '${ownerTwo}');
  INSERT INTO business_workspaces (id, account_id, name) VALUES
    ('${workspaceOne}', '90000000-0000-4000-8000-000000000001', 'Workspace One'),
    ('${workspaceTwo}', '90000000-0000-4000-8000-000000000002', 'Workspace Two');
  INSERT INTO restaurants (id, workspace_id, name, owner_email) VALUES
    ('${restaurantOne}', '${workspaceOne}', 'Location One', 'one@example.com'),
    ('${restaurantTwo}', '${workspaceTwo}', 'Location Two', 'two@example.com');
  INSERT INTO reviews (id, restaurant_id, rating, review_text, review_timestamp) VALUES
    ('${reviewOne}', '${restaurantOne}', 2, 'Nobody sent the promised update before closing.', 1794765600000),
    ('${reviewTwo}', '${restaurantTwo}', 1, 'The other workspace feedback must remain isolated.', 1794765600000);
`

async function database() {
  const db = new PGlite()
  await db.exec(baseSchema)
  await db.exec(await migrationSql)
  return db
}

function procedureSnapshot(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    title: 'Customer status updates',
    category: 'Customer Communication',
    description: 'Set and meet a clear customer update commitment.',
    objective: 'Reduce avoidable uncertainty while work is open.',
    steps: ['Record the next update time.', 'Contact the customer by that time.'],
    responsible_role_id: null,
    assigned_person_id: null,
    status: 'draft',
    ...overrides,
  })
}

async function createProcedure(db: PGlite, snapshot = procedureSnapshot()) {
  const result = await db.query<{ id: string }>(
    'SELECT playbook_create_procedure($1::uuid, $2::uuid, $3::jsonb, $4) AS id',
    [workspaceOne, ownerOne, snapshot, 'Initial documented process'],
  )
  return result.rows[0].id
}

test('migration is additive, inert, and repeatable', async t => {
  const db = await database()
  t.after(() => db.close())
  const counts = await db.query<{ procedures: number; roles: number; proposals: number }>(`
    SELECT
      (SELECT count(*)::int FROM playbook_procedures) AS procedures,
      (SELECT count(*)::int FROM playbook_roles) AS roles,
      (SELECT count(*)::int FROM playbook_change_proposals) AS proposals
  `)
  assert.deepEqual(counts.rows[0], { procedures: 0, roles: 0, proposals: 0 })
  await db.exec(await migrationSql)
  const tables = await db.query<{ count: number }>(`
    SELECT count(*)::int AS count FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'playbook_%'
  `)
  assert.equal(tables.rows[0].count, 7)
})

test('roles, directory people, and responsibility references cannot cross workspaces', async t => {
  const db = await database()
  t.after(() => db.close())
  const roles = await db.query<{ id: string; workspace_id: string }>(`
    INSERT INTO playbook_roles (workspace_id, name, department, created_by) VALUES
      ('${workspaceOne}', 'Service Advisor', 'Operations', '${ownerOne}'),
      ('${workspaceTwo}', 'Other Advisor', 'Operations', '${ownerTwo}')
    RETURNING id, workspace_id
  `)
  const roleOne = roles.rows.find(row => row.workspace_id === workspaceOne)!.id
  const roleTwo = roles.rows.find(row => row.workspace_id === workspaceTwo)!.id
  await assert.rejects(
    db.query(`INSERT INTO playbook_people (workspace_id, display_name, job_title, department, role_id) VALUES ($1, 'Cross User', 'Advisor', 'Operations', $2)`, [workspaceOne, roleTwo]),
    /foreign key/i,
  )
  const person = await db.query<{ id: string }>(
    `INSERT INTO playbook_people (workspace_id, display_name, job_title, department, role_id) VALUES ($1, 'Directory Person', 'Advisor', 'Operations', $2) RETURNING id`,
    [workspaceOne, roleOne],
  )
  assert.ok(person.rows[0].id)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM auth.users')).rows[0].count, 2)
  await assert.rejects(
    createProcedure(db, procedureSnapshot({ responsible_role_id: roleTwo })),
    /invalid_role/,
  )
})

test('column-specific SET NULL actions preserve workspace identity across referenced deletions', async t => {
  const db = await database()
  t.after(() => db.close())

  const roleId = (await db.query<{ id: string }>(
    `INSERT INTO playbook_roles (workspace_id, name, department) VALUES ($1, 'Deletion Role', 'Operations') RETURNING id`,
    [workspaceOne],
  )).rows[0].id
  const personId = (await db.query<{ id: string }>(
    `INSERT INTO playbook_people (workspace_id, display_name, job_title, department, role_id)
     VALUES ($1, 'Deletion Person', 'Advisor', 'Operations', $2) RETURNING id`,
    [workspaceOne, roleId],
  )).rows[0].id
  const procedureId = await createProcedure(db, procedureSnapshot({
    responsible_role_id: roleId,
    assigned_person_id: personId,
  }))
  const proposalId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_change_proposals (
      workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
      expected_benefit, priority, rationale, suggested_role_id, model
    ) VALUES (
      $1, $2, 'change_procedure', 'Deletion behavior must preserve the tenant key.', $3::jsonb,
      'Hypothesis: safe nulling preserves related audit records.', 'medium',
      'This proposal exists to exercise composite foreign-key deletion behavior.', $4, 'test-model'
    ) RETURNING id
  `, [workspaceOne, procedureId, procedureSnapshot(), roleId])).rows[0].id
  const taskId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_tasks (
      workspace_id, procedure_id, proposal_id, role_id, person_id, title
    ) VALUES ($1, $2, $3, $4, $5, 'Deletion relationship regression') RETURNING id
  `, [workspaceOne, procedureId, proposalId, roleId, personId])).rows[0].id

  await db.query('DELETE FROM playbook_roles WHERE id = $1', [roleId])
  const afterRole = await db.query<{
    person_workspace: string; person_role: string | null
    procedure_workspace: string; procedure_role: string | null
    proposal_workspace: string; proposal_role: string | null
    task_workspace: string; task_role: string | null
  }>(`
    SELECT
      person.workspace_id AS person_workspace, person.role_id AS person_role,
      procedure.workspace_id AS procedure_workspace, procedure.responsible_role_id AS procedure_role,
      proposal.workspace_id AS proposal_workspace, proposal.suggested_role_id AS proposal_role,
      task.workspace_id AS task_workspace, task.role_id AS task_role
    FROM playbook_people person
    JOIN playbook_procedures procedure ON procedure.id = $1
    JOIN playbook_change_proposals proposal ON proposal.id = $2
    JOIN playbook_tasks task ON task.id = $3
    WHERE person.id = $4
  `, [procedureId, proposalId, taskId, personId])
  assert.deepEqual(afterRole.rows[0], {
    person_workspace: workspaceOne, person_role: null,
    procedure_workspace: workspaceOne, procedure_role: null,
    proposal_workspace: workspaceOne, proposal_role: null,
    task_workspace: workspaceOne, task_role: null,
  })

  await db.query('DELETE FROM playbook_people WHERE id = $1', [personId])
  const afterPerson = await db.query<{
    procedure_workspace: string; assigned_person_id: string | null
    task_workspace: string; person_id: string | null
  }>(`
    SELECT procedure.workspace_id AS procedure_workspace, procedure.assigned_person_id,
           task.workspace_id AS task_workspace, task.person_id
    FROM playbook_procedures procedure
    JOIN playbook_tasks task ON task.id = $2
    WHERE procedure.id = $1
  `, [procedureId, taskId])
  assert.deepEqual(afterPerson.rows[0], {
    procedure_workspace: workspaceOne, assigned_person_id: null,
    task_workspace: workspaceOne, person_id: null,
  })

  await db.query('DELETE FROM playbook_procedures WHERE id = $1', [procedureId])
  const afterProcedure = await db.query<{
    workspace_id: string; procedure_id: string | null; proposal_id: string | null
  }>('SELECT workspace_id, procedure_id, proposal_id FROM playbook_tasks WHERE id = $1', [taskId])
  assert.deepEqual(afterProcedure.rows[0], {
    workspace_id: workspaceOne, procedure_id: null, proposal_id: null,
  })
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_versions WHERE procedure_id = $1', [procedureId])).rows[0].count, 0)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_change_proposals WHERE id = $1', [proposalId])).rows[0].count, 0)

  const retainedProcedureId = await createProcedure(db, procedureSnapshot({ title: 'Retained audit procedure' }))
  const retainedProposalId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_change_proposals (
      workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
      expected_benefit, priority, rationale, model
    ) VALUES (
      $1, $2, 'change_procedure', 'Proposal deletion must retain version history.', $3::jsonb,
      'Hypothesis: retained history supports later audits.', 'low',
      'This proposal exists to verify nullable proposal references.', 'test-model'
    ) RETURNING id
  `, [workspaceOne, retainedProcedureId, procedureSnapshot()])).rows[0].id
  const retainedVersionId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_versions (
      workspace_id, procedure_id, version_number, snapshot, change_summary, source, source_proposal_id
    ) VALUES ($1, $2, 2, $3::jsonb, 'Proposal-linked audit version', 'ai_proposal', $4)
    RETURNING id
  `, [workspaceOne, retainedProcedureId, procedureSnapshot(), retainedProposalId])).rows[0].id
  const retainedTaskId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_tasks (workspace_id, proposal_id, title)
    VALUES ($1, $2, 'Retain task after proposal deletion') RETURNING id
  `, [workspaceOne, retainedProposalId])).rows[0].id
  await db.query(`
    INSERT INTO playbook_proposal_evidence (workspace_id, proposal_id, restaurant_id, review_id)
    VALUES ($1, $2, $3, $4)
  `, [workspaceOne, retainedProposalId, restaurantOne, reviewOne])

  await db.query('DELETE FROM playbook_change_proposals WHERE id = $1', [retainedProposalId])
  const afterProposal = await db.query<{
    version_workspace: string; source_proposal_id: string | null
    task_workspace: string; task_proposal_id: string | null
  }>(`
    SELECT version.workspace_id AS version_workspace, version.source_proposal_id,
           task.workspace_id AS task_workspace, task.proposal_id AS task_proposal_id
    FROM playbook_versions version
    JOIN playbook_tasks task ON task.id = $2
    WHERE version.id = $1
  `, [retainedVersionId, retainedTaskId])
  assert.deepEqual(afterProposal.rows[0], {
    version_workspace: workspaceOne, source_proposal_id: null,
    task_workspace: workspaceOne, task_proposal_id: null,
  })
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_proposal_evidence WHERE proposal_id = $1', [retainedProposalId])).rows[0].count, 0)

  const appliedProposalId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_change_proposals (
      workspace_id, procedure_id, proposal_kind, problem, proposed_snapshot,
      expected_benefit, priority, rationale, model, status, approved_by, approved_at,
      applied_version_id
    ) VALUES (
      $1, $2, 'change_procedure', 'Applied-version deletion must preserve workspace identity.', $3::jsonb,
      'Hypothesis: safe nulling retains the proposal audit.', 'low',
      'This proposal exists to verify applied-version deletion behavior.', 'test-model',
      'applied', $4, now(), $5
    ) RETURNING id
  `, [workspaceOne, retainedProcedureId, procedureSnapshot(), ownerOne, retainedVersionId])).rows[0].id
  await db.query('DELETE FROM playbook_versions WHERE id = $1', [retainedVersionId])
  const afterVersion = await db.query<{ workspace_id: string; applied_version_id: string | null }>(
    'SELECT workspace_id, applied_version_id FROM playbook_change_proposals WHERE id = $1',
    [appliedProposalId],
  )
  assert.deepEqual(afterVersion.rows[0], { workspace_id: workspaceOne, applied_version_id: null })
})

test('draft, activation, archive, and concurrent edits append versions without overwriting history', async t => {
  const db = await database()
  t.after(() => db.close())
  const procedureId = await createProcedure(db)

  const initial = await db.query<{ status: string; current_version: number; lock_version: number }>('SELECT status, current_version, lock_version FROM playbook_procedures WHERE id = $1', [procedureId])
  assert.deepEqual(initial.rows[0], { status: 'draft', current_version: 1, lock_version: 1 })

  await db.query(
    'SELECT playbook_update_procedure($1, $2, 1, $3, $4::jsonb, $5)',
    [workspaceOne, procedureId, ownerOne, procedureSnapshot({ status: 'active' }), 'Owner approved the active process'],
  )
  await assert.rejects(
    db.query('SELECT playbook_update_procedure($1, $2, 1, $3, $4::jsonb, $5)', [workspaceOne, procedureId, ownerOne, procedureSnapshot(), 'Stale update']),
    /procedure_conflict/,
  )
  await db.query(
    'SELECT playbook_update_procedure($1, $2, 2, $3, $4::jsonb, $5)',
    [workspaceOne, procedureId, ownerOne, procedureSnapshot({ status: 'archived' }), 'Archived after process replacement'],
  )
  const versions = await db.query<{ version_number: number; status: string; approved: boolean }>(`
    SELECT version_number, snapshot->>'status' AS status, approved_by IS NOT NULL AS approved
    FROM playbook_versions WHERE procedure_id = $1 ORDER BY version_number
  `, [procedureId])
  assert.deepEqual(versions.rows, [
    { version_number: 1, status: 'draft', approved: false },
    { version_number: 2, status: 'active', approved: true },
    { version_number: 3, status: 'archived', approved: false },
  ])
})

test('AI proposal evidence must belong to the same workspace and proposal creation is atomic', async t => {
  const db = await database()
  t.after(() => db.close())
  const procedureId = await createProcedure(db)
  const secondReview = '30000000-0000-4000-8000-000000000003'
  await db.query(`INSERT INTO reviews (id, restaurant_id, rating, review_text, review_timestamp) VALUES ($1, $2, 2, 'I had to call twice for a status update.', 1794765600000)`, [secondReview, restaurantOne])
  const proposal = [{
    proposal_kind: 'change_procedure', procedure_id: procedureId,
    problem: 'Customers repeatedly miss promised progress updates.',
    proposed_snapshot: JSON.parse(procedureSnapshot({ status: 'draft' })),
    expected_benefit: 'Hypothesis: a logged update time may reduce avoidable status calls.',
    priority: 'high', rationale: 'Two authorized records describe the same missed-update pattern.',
    suggested_role_id: null, evidence_ids: [reviewOne, secondReview],
  }]
  const created = await db.query<{ ids: string[] }>(
    'SELECT playbook_create_ai_proposals($1, $2, $3, $4::jsonb) AS ids',
    [workspaceOne, ownerOne, 'test-model', JSON.stringify(proposal)],
  )
  assert.equal(created.rows[0].ids.length, 1)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_proposal_evidence')).rows[0].count, 2)

  const invalid = structuredClone(proposal)
  invalid[0].evidence_ids = [reviewOne, reviewTwo]
  await assert.rejects(
    db.query('SELECT playbook_create_ai_proposals($1, $2, $3, $4::jsonb)', [workspaceOne, ownerOne, 'test-model', JSON.stringify(invalid)]),
    /unauthorized_evidence/,
  )
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_change_proposals')).rows[0].count, 1)
})

test('proposal editing validates snapshot responsibilities before preserving approval and application behavior', async t => {
  const db = await database()
  t.after(() => db.close())
  const role = (await db.query<{ id: string }>(`INSERT INTO playbook_roles (workspace_id, name, department) VALUES ($1, 'Service Advisor', 'Operations') RETURNING id`, [workspaceOne])).rows[0].id
  const inactiveRole = (await db.query<{ id: string }>(`INSERT INTO playbook_roles (workspace_id, name, department, active) VALUES ($1, 'Inactive Advisor', 'Operations', false) RETURNING id`, [workspaceOne])).rows[0].id
  const crossWorkspaceRole = (await db.query<{ id: string }>(`INSERT INTO playbook_roles (workspace_id, name, department) VALUES ($1, 'Other Workspace Advisor', 'Operations') RETURNING id`, [workspaceTwo])).rows[0].id
  const person = (await db.query<{ id: string }>(`
    INSERT INTO playbook_people (workspace_id, display_name, job_title, department, role_id)
    VALUES ($1, 'Morgan Owner', 'Service Advisor', 'Operations', $2) RETURNING id
  `, [workspaceOne, role])).rows[0].id
  const inactivePerson = (await db.query<{ id: string }>(`
    INSERT INTO playbook_people (workspace_id, display_name, job_title, department, active)
    VALUES ($1, 'Inactive Person', 'Advisor', 'Operations', false) RETURNING id
  `, [workspaceOne])).rows[0].id
  const crossWorkspacePerson = (await db.query<{ id: string }>(`
    INSERT INTO playbook_people (workspace_id, display_name, job_title, department)
    VALUES ($1, 'Other Workspace Person', 'Advisor', 'Operations') RETURNING id
  `, [workspaceTwo])).rows[0].id
  const procedureId = await createProcedure(db, procedureSnapshot({ responsible_role_id: role }))
  const secondReview = '30000000-0000-4000-8000-000000000004'
  await db.query(`INSERT INTO reviews (id, restaurant_id, rating, review_text, review_timestamp) VALUES ($1, $2, 2, 'Updates arrived after the promised time.', 1794765600000)`, [secondReview, restaurantOne])
  const proposalJson = JSON.stringify([{
    proposal_kind: 'change_procedure', procedure_id: procedureId,
    problem: 'Promised status updates are not consistently delivered.',
    proposed_snapshot: JSON.parse(procedureSnapshot({ responsible_role_id: role, status: 'draft', steps: ['Record an update time.', 'Send the update by that time.', 'Log the next commitment.'] })),
    expected_benefit: 'Hypothesis: clearer ownership may make update timing more reliable.',
    priority: 'high', rationale: 'Multiple records describe the same communication gap.',
    suggested_role_id: role, evidence_ids: [reviewOne, secondReview],
  }])
  const proposalId = (await db.query<{ ids: string[] }>('SELECT playbook_create_ai_proposals($1, $2, $3, $4::jsonb) AS ids', [workspaceOne, ownerOne, 'test-model', proposalJson])).rows[0].ids[0]

  for (const [snapshot, expectedError] of [
    [procedureSnapshot({ responsible_role_id: crossWorkspaceRole }), /invalid_role/],
    [procedureSnapshot({ responsible_role_id: inactiveRole }), /invalid_role/],
    [procedureSnapshot({ assigned_person_id: crossWorkspacePerson }), /invalid_person/],
    [procedureSnapshot({ assigned_person_id: inactivePerson }), /invalid_person/],
  ] as const) {
    await assert.rejects(
      db.query(`SELECT playbook_review_proposal($1, $2, 1, $3, 'edit', $4::jsonb)`, [
        workspaceOne, proposalId, ownerOne,
        JSON.stringify({ proposed_snapshot: JSON.parse(snapshot) }),
      ]),
      expectedError,
    )
  }

  await db.query(`SELECT playbook_review_proposal($1, $2, 1, $3, 'edit', $4::jsonb)`, [
    workspaceOne, proposalId, ownerOne,
    JSON.stringify({
      rationale: 'Owner clarified the implementation rationale.',
      priority: 'medium',
      proposed_snapshot: JSON.parse(procedureSnapshot({ responsible_role_id: role, assigned_person_id: person })),
    }),
  ])
  const edited = await db.query<{ suggested_role_id: string; priority: string; responsible_role_id: string; assigned_person_id: string }>(`
    SELECT suggested_role_id, priority,
      proposed_snapshot->>'responsible_role_id' AS responsible_role_id,
      proposed_snapshot->>'assigned_person_id' AS assigned_person_id
    FROM playbook_change_proposals WHERE id = $1
  `, [proposalId])
  assert.equal(edited.rows[0].suggested_role_id, role)
  assert.equal(edited.rows[0].priority, 'medium')
  assert.equal(edited.rows[0].responsible_role_id, role)
  assert.equal(edited.rows[0].assigned_person_id, person)
  await db.query(`SELECT playbook_review_proposal($1, $2, 2, $3, 'approve', NULL)`, [workspaceOne, proposalId, ownerOne])
  const applied = await db.query<{ result: { procedure_id: string; version_id: string; already_applied: boolean } }>(
    'SELECT playbook_apply_proposal($1, $2, 3, 1, $3, $4) AS result',
    [workspaceOne, proposalId, ownerTwo, 'Authorized operator applied the owner-approved update'],
  )
  assert.equal(applied.rows[0].result.already_applied, false)
  const repeated = await db.query<{ result: { already_applied: boolean } }>(
    'SELECT playbook_apply_proposal($1, $2, 999, 999, $3, $4) AS result',
    [workspaceOne, proposalId, ownerOne, 'Repeated request'],
  )
  assert.equal(repeated.rows[0].result.already_applied, true)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM playbook_versions WHERE procedure_id = $1', [procedureId])).rows[0].count, 2)
  const audit = await db.query<{ approved_by: string; created_by: string }>(`
    SELECT approved_by, created_by FROM playbook_versions WHERE id = $1
  `, [applied.rows[0].result.version_id])
  assert.deepEqual(audit.rows[0], { approved_by: ownerOne, created_by: ownerTwo })

  const rejectedId = (await db.query<{ id: string }>(`
    INSERT INTO playbook_change_proposals (
      workspace_id, proposal_kind, problem, proposed_snapshot, expected_benefit,
      priority, rationale, status, model
    ) VALUES ($1, 'new_procedure', 'A separate supported problem needs review.', $2::jsonb,
      'Hypothesis: a documented process could improve consistency.', 'low',
      'The owner must still inspect and decide on this proposal.', 'pending', 'test-model') RETURNING id
  `, [workspaceOne, procedureSnapshot()])).rows[0].id
  await db.query(`SELECT playbook_review_proposal($1, $2, 1, $3, 'reject', NULL)`, [workspaceOne, rejectedId, ownerOne])
  const rejected = await db.query<{ status: string; rejected: boolean }>('SELECT status, rejected_at IS NOT NULL AS rejected FROM playbook_change_proposals WHERE id = $1', [rejectedId])
  assert.deepEqual(rejected.rows[0], { status: 'rejected', rejected: true })
})

test('task links enforce workspace equality and durable AI reservations reject nulls and enforce limits atomically', async t => {
  const db = await database()
  t.after(() => db.close())
  const procedureOne = await createProcedure(db)
  const procedureTwo = (await db.query<{ id: string }>(
    'SELECT playbook_create_procedure($1, $2, $3::jsonb, $4) AS id',
    [workspaceTwo, ownerTwo, procedureSnapshot({ title: 'Other workspace procedure' }), 'Initial other process'],
  )).rows[0].id
  await db.query(`INSERT INTO playbook_tasks (workspace_id, procedure_id, title, priority, status) VALUES ($1, $2, 'Run update process pilot', 'high', 'in_progress')`, [workspaceOne, procedureOne])
  await assert.rejects(
    db.query(`INSERT INTO playbook_tasks (workspace_id, procedure_id, title) VALUES ($1, $2, 'Cross workspace task')`, [workspaceOne, procedureTwo]),
    /foreign key/i,
  )

  await assert.rejects(
    db.query(`SELECT playbook_reserve_ai_run(NULL::text, now() - interval '10 minutes', 4)`),
    /invalid_rate_limit_request/,
  )
  await assert.rejects(
    db.query(`SELECT playbook_reserve_ai_run('playbook_ai_limit_real_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NULL::timestamptz, 4)`),
    /invalid_rate_limit_request/,
  )
  await assert.rejects(
    db.query(`SELECT playbook_reserve_ai_run('playbook_ai_limit_real_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', now() - interval '10 minutes', NULL::integer)`),
    /invalid_rate_limit_request/,
  )

  const validOperation = 'playbook_ai_limit_real_cccccccccccccccccccccccccccccccc'
  const firstValid = await db.query<{ allowed: boolean }>(
    `SELECT playbook_reserve_ai_run($1, now() - interval '10 minutes', 1) AS allowed`,
    [validOperation],
  )
  const exhaustedValid = await db.query<{ allowed: boolean }>(
    `SELECT playbook_reserve_ai_run($1, now() - interval '10 minutes', 1) AS allowed`,
    [validOperation],
  )
  assert.equal(firstValid.rows[0].allowed, true)
  assert.equal(exhaustedValid.rows[0].allowed, false)

  const operation = 'playbook_ai_limit_real_0123456789abcdef0123456789abcdef'
  const reservations = await Promise.all([1, 2, 3, 4, 5].map(() => db.query<{ allowed: boolean }>(
    'SELECT playbook_reserve_ai_run($1, now() - interval \'10 minutes\', 4) AS allowed',
    [operation],
  )))
  assert.equal(reservations.filter(result => result.rows[0].allowed).length, 4)
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM api_usage_log WHERE operation = $1', [operation])).rows[0].count, 4)
})

test('RLS is enabled, owner reads are scoped, and authenticated users cannot write directly', async t => {
  const db = await database()
  t.after(() => db.close())
  const rls = await db.query<{ table_name: string; rls: boolean }>(`
    SELECT relname AS table_name, relrowsecurity AS rls
    FROM pg_class WHERE relname LIKE 'playbook_%' AND relkind = 'r'
    ORDER BY relname
  `)
  assert.equal(rls.rows.length, 7)
  assert.ok(rls.rows.every(row => row.rls))
  const policies = await db.query<{ count: number }>(`SELECT count(*)::int AS count FROM pg_policies WHERE policyname = 'workspace owner select'`)
  assert.equal(policies.rows[0].count, 7)
  const privileges = await db.query<{ insert_allowed: boolean; select_allowed: boolean }>(`
    SELECT
      has_table_privilege('authenticated', 'playbook_procedures', 'INSERT') AS insert_allowed,
      has_table_privilege('authenticated', 'playbook_procedures', 'SELECT') AS select_allowed
  `)
  assert.deepEqual(privileges.rows[0], { insert_allowed: false, select_allowed: true })
})

test('SECURITY DEFINER functions have safe paths and service-role-only execute privileges', async t => {
  const db = await database()
  t.after(() => db.close())
  const functions = await db.query<{
    name: string
    security_definer: boolean
    settings: string[] | null
  }>(`
    SELECT procedure.proname AS name,
           procedure.prosecdef AS security_definer,
           procedure.proconfig AS settings
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'playbook_reserve_ai_run', 'playbook_create_procedure',
        'playbook_update_procedure', 'playbook_create_ai_proposals',
        'playbook_review_proposal', 'playbook_apply_proposal'
      )
    ORDER BY procedure.proname
  `)
  assert.equal(functions.rows.length, 6)
  assert.ok(functions.rows.every(row => row.security_definer))
  assert.ok(functions.rows.every(row => row.settings?.includes('search_path=pg_catalog, pg_temp')))

  const signatures = [
    'public.playbook_reserve_ai_run(text,timestamp with time zone,integer)',
    'public.playbook_create_procedure(uuid,uuid,jsonb,text)',
    'public.playbook_update_procedure(uuid,uuid,integer,uuid,jsonb,text)',
    'public.playbook_create_ai_proposals(uuid,uuid,text,jsonb)',
    'public.playbook_review_proposal(uuid,uuid,integer,uuid,text,jsonb)',
    'public.playbook_apply_proposal(uuid,uuid,integer,integer,uuid,text)',
  ]
  for (const signature of signatures) {
    const privileges = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(`
      SELECT
        has_function_privilege('anon', $1, 'EXECUTE') AS anon,
        has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated,
        has_function_privilege('service_role', $1, 'EXECUTE') AS service
    `, [signature])
    assert.deepEqual(privileges.rows[0], { anon: false, authenticated: false, service: true }, signature)
  }

  await db.exec('SET ROLE authenticated')
  await assert.rejects(
    db.query('SELECT public.playbook_create_procedure($1, $2, $3::jsonb, $4)', [workspaceOne, ownerOne, procedureSnapshot(), 'Unauthorized attempt']),
    /permission denied/i,
  )
  await assert.rejects(
    db.exec('CREATE TABLE pg_catalog.playbook_procedures (id uuid)'),
    /permission denied|system catalog/i,
  )
  await db.exec('RESET ROLE')

  await db.exec('SET ROLE service_role')
  await db.exec('CREATE TEMP TABLE playbook_procedures (id uuid)')
  const created = await db.query<{ id: string }>(
    'SELECT public.playbook_create_procedure($1, $2, $3::jsonb, $4) AS id',
    [workspaceOne, ownerOne, procedureSnapshot({ title: 'Secure search path procedure' }), 'Secure path test'],
  )
  await db.exec('RESET ROLE')
  assert.equal((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM public.playbook_procedures WHERE id = $1', [created.rows[0].id])).rows[0].count, 1)
})

test('a transactional migration failure rolls back function creation and grants together', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(baseSchema)
  await assert.rejects(
    db.exec(`BEGIN;\n${await migrationSql}\nSELECT definitely_missing_playbook_function();\nCOMMIT;`),
  )
  await db.exec('ROLLBACK')
  const state = await db.query<{ function_exists: boolean; table_exists: boolean }>(`
    SELECT
      to_regprocedure('public.playbook_create_procedure(uuid,uuid,jsonb,text)') IS NOT NULL AS function_exists,
      to_regclass('public.playbook_procedures') IS NOT NULL AS table_exists
  `)
  assert.deepEqual(state.rows[0], { function_exists: false, table_exists: false })
})
