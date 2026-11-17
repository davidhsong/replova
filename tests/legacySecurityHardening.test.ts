import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationDirectory = path.join(repoRoot, 'supabase', 'migrations')

const prelude = `
  CREATE SCHEMA auth;
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE TABLE auth.users (
    id uuid PRIMARY KEY,
    email text,
    email_confirmed_at timestamptz,
    created_at timestamptz DEFAULT now()
  );
  CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
  CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.email', true), '')
    $$;
  CREATE SCHEMA storage;
  CREATE TABLE storage.buckets (
    id text PRIMARY KEY,
    name text,
    public boolean,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  CREATE SCHEMA supabase_migrations;
  CREATE TABLE supabase_migrations.schema_migrations (
    version text PRIMARY KEY,
    name text
  );
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`

function pgliteCompatibleSql(sql: string): string {
  return sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;/gi, '')
}

async function migrationFiles(through: number): Promise<string[]> {
  return (await readdir(migrationDirectory))
    .filter(name => /^\d{3}_.+\.sql$/.test(name) && Number(name.slice(0, 3)) <= through)
    .sort()
}

async function applyMigration(database: PGlite, name: string): Promise<void> {
  const sql = pgliteCompatibleSql(await readFile(path.join(migrationDirectory, name), 'utf8'))
  await database.exec('BEGIN')
  try {
    await database.exec(sql)
    await database.exec('COMMIT')
  } catch (error) {
    await database.exec('ROLLBACK')
    throw error
  }
}

async function createDatabase(through = 33): Promise<PGlite> {
  const database = new PGlite()
  await database.exec(prelude)
  for (const name of await migrationFiles(through)) await applyMigration(database, name)
  return database
}

async function expectRoleRejected(
  database: PGlite,
  role: 'anon' | 'authenticated',
  sql: string,
  pattern: RegExp,
): Promise<void> {
  await database.exec('BEGIN')
  try {
    await database.exec(`SET LOCAL ROLE ${role}`)
    await assert.rejects(database.query(sql), pattern)
  } finally {
    await database.exec('ROLLBACK')
  }
}

async function setAuthenticatedOwner(database: PGlite, userId: string, email: string) {
  await database.exec(`
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${userId}', true);
    SELECT set_config('request.jwt.claim.email', '${email}', true);
  `)
}

let database: PGlite

before(async () => {
  database = await createDatabase()
})

after(async () => {
  await database.close()
})

test('all intended migrations through 033 apply transactionally and exclude 026', async () => {
  const names = await migrationFiles(33)
  assert.equal(names.length, 33)
  assert.equal(names.at(-1), '033_legacy_security_hardening.sql')
  assert.equal(names.some(name => name.startsWith('026_')), false)

  const nullable = await database.query<{ is_nullable: string }>(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'review_requests'
      AND column_name = 'customer_email'
  `)
  assert.equal(nullable.rows[0].is_nullable, 'NO')
})

test('migration 033 is repeatable after a successful application', async () => {
  await applyMigration(database, '033_legacy_security_hardening.sql')
})

test('migration 033 fails closed without changing nullable historical rows', async t => {
  const legacy = await createDatabase(32)
  t.after(() => legacy.close())

  await legacy.exec(`
    INSERT INTO public.restaurants (id, name, place_id, owner_email)
    VALUES (
      '01000000-0000-0000-0000-000000000001',
      'Legacy business',
      'legacy-place',
      'legacy@example.test'
    );
    INSERT INTO public.review_requests (id, restaurant_id, customer_email)
    VALUES (
      '02000000-0000-0000-0000-000000000001',
      '01000000-0000-0000-0000-000000000001',
      NULL
    );
  `)

  await assert.rejects(
    applyMigration(legacy, '033_legacy_security_hardening.sql'),
    /customer_email_nulls_require_manual_remediation/i,
  )

  const state = await legacy.query<{ null_rows: number; is_nullable: string }>(`
    SELECT
      (SELECT count(*)::integer FROM public.review_requests WHERE customer_email IS NULL) AS null_rows,
      (SELECT is_nullable FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'review_requests'
         AND column_name = 'customer_email') AS is_nullable
  `)
  assert.deepEqual(state.rows[0], { null_rows: 1, is_nullable: 'YES' })
})

test('legacy functions have least-privilege ACLs and hardened search paths', async () => {
  const signatures = [
    'public.claim_due_replies(integer)',
    'public.increment_api_spend(double precision)',
    'public.owns_restaurant(uuid)',
  ] as const

  for (const signature of signatures) {
    const result = await database.query<{
      anon_execute: boolean
      authenticated_execute: boolean
      service_execute: boolean
      configuration: string[]
    }>(`
      SELECT
        has_function_privilege('anon', $1, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated_execute,
        has_function_privilege('service_role', $1, 'EXECUTE') AS service_execute,
        coalesce(procedure.proconfig, ARRAY[]::text[]) AS configuration
      FROM pg_proc AS procedure
      WHERE procedure.oid = $1::regprocedure
    `, [signature])
    const row = result.rows[0]
    assert.equal(row.anon_execute, false, signature)
    assert.equal(row.authenticated_execute, signature === 'public.owns_restaurant(uuid)', signature)
    assert.equal(row.service_execute, true, signature)
    assert.ok(row.configuration.includes('search_path=pg_catalog, public, pg_temp'), signature)
  }

  const definerAccess = await database.query<{
    function_name: string
    anon_execute: boolean
    authenticated_execute: boolean
  }>(`
    SELECT
      procedure.proname AS function_name,
      has_function_privilege('anon', procedure.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', procedure.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.prosecdef
    ORDER BY procedure.proname
  `)
  assert.deepEqual(
    definerAccess.rows.filter(row => row.anon_execute).map(row => row.function_name),
    [],
  )
  assert.deepEqual(
    definerAccess.rows.filter(row => row.authenticated_execute).map(row => row.function_name),
    [
      'current_user_owns_replova_account',
      'current_user_owns_replova_workspace',
      'owns_restaurant',
      'owns_youtube_connection',
    ],
  )

  const allClientFunctionAccess = await database.query<{
    function_name: string
    anon_execute: boolean
    authenticated_execute: boolean
  }>(`
    SELECT
      procedure.proname AS function_name,
      has_function_privilege('anon', procedure.oid, 'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated', procedure.oid, 'EXECUTE') AS authenticated_execute
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND (
        has_function_privilege('anon', procedure.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      )
    ORDER BY procedure.proname
  `)
  assert.deepEqual(
    allClientFunctionAccess.rows.filter(row => row.anon_execute).map(row => row.function_name),
    [],
  )
  assert.deepEqual(
    allClientFunctionAccess.rows.filter(row => row.authenticated_execute).map(row => row.function_name),
    [
      'current_user_owns_replova_account',
      'current_user_owns_replova_workspace',
      'owns_restaurant',
      'owns_youtube_connection',
    ],
  )
})

test('every public table has RLS and API roles lack bypass-style table privileges', async () => {
  const withoutRls = await database.query<{ table_name: string }>(`
    SELECT class.relname AS table_name
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relkind IN ('r', 'p')
      AND NOT class.relrowsecurity
    ORDER BY class.relname
  `)
  assert.deepEqual(withoutRls.rows, [])

  const dangerousGrants = await database.query<{
    table_name: string
    grantee: string
    privilege_type: string
  }>(`
    SELECT
      class.relname AS table_name,
      coalesce(role.rolname, 'PUBLIC') AS grantee,
      privilege.privilege_type
    FROM pg_class AS class
    JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(class.relacl, acldefault('r', class.relowner))) AS privilege
    LEFT JOIN pg_roles AS role ON role.oid = privilege.grantee
    WHERE namespace.nspname = 'public'
      AND class.relkind IN ('r', 'p')
      AND coalesce(role.rolname, 'PUBLIC') IN ('PUBLIC', 'anon', 'authenticated')
      AND privilege.privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
    ORDER BY class.relname, grantee, privilege.privilege_type
  `)
  assert.deepEqual(dangerousGrants.rows, [])

  for (const table of ['api_budget_state', 'api_usage_log']) {
    const privileges = await database.query<{
      anon_select: boolean
      authenticated_select: boolean
      service_select: boolean
      service_insert: boolean
      service_update: boolean
    }>(`
      SELECT
        has_table_privilege('anon', $1, 'SELECT') AS anon_select,
        has_table_privilege('authenticated', $1, 'SELECT') AS authenticated_select,
        has_table_privilege('service_role', $1, 'SELECT') AS service_select,
        has_table_privilege('service_role', $1, 'INSERT') AS service_insert,
        has_table_privilege('service_role', $1, 'UPDATE') AS service_update
    `, [`public.${table}`])
    assert.deepEqual(privileges.rows[0], {
      anon_select: false,
      authenticated_select: false,
      service_select: true,
      service_insert: true,
      service_update: true,
    })
  }
})

test('anon and authenticated roles cannot read budgets or claim server work', async () => {
  await expectRoleRejected(
    database,
    'anon',
    'SELECT * FROM public.api_budget_state',
    /permission denied for table api_budget_state/i,
  )
  await expectRoleRejected(
    database,
    'authenticated',
    'SELECT * FROM public.api_usage_log',
    /permission denied for table api_usage_log/i,
  )
  await expectRoleRejected(
    database,
    'anon',
    'SELECT * FROM public.claim_due_replies(1)',
    /permission denied for function claim_due_replies/i,
  )
  await expectRoleRejected(
    database,
    'authenticated',
    'SELECT * FROM public.increment_api_spend(1.0)',
    /permission denied for function increment_api_spend/i,
  )
})

test('authenticated ownership RLS allows self and rejects cross-workspace access', async () => {
  await database.exec(`
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
      ('10000000-0000-0000-0000-000000000001', 'owner-one@example.test', now()),
      ('10000000-0000-0000-0000-000000000002', 'owner-two@example.test', now());
    INSERT INTO public.accounts (id, owner_email, auth_user_id) VALUES
      ('20000000-0000-0000-0000-000000000001', 'owner-one@example.test', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000002', 'owner-two@example.test', '10000000-0000-0000-0000-000000000002');
    INSERT INTO public.business_workspaces (id, account_id, name) VALUES
      ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Owner one workspace'),
      ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Owner two workspace');
    INSERT INTO public.restaurants (id, workspace_id, name, place_id, owner_email, active) VALUES
      ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Owner one business', 'owner-one-place', 'owner-one@example.test', true),
      ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Owner two business', 'owner-two-place', 'owner-two@example.test', true);
    INSERT INTO public.review_requests (id, restaurant_id, customer_email) VALUES
      ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'customer-one@example.test'),
      ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'customer-two@example.test');
  `)

  await database.exec('BEGIN')
  try {
    await setAuthenticatedOwner(
      database,
      '10000000-0000-0000-0000-000000000001',
      'owner-one@example.test',
    )
    const access = await database.query<{
      owns_self: boolean
      owns_other: boolean
      visible_requests: number
    }>(`
      SELECT
        public.owns_restaurant('40000000-0000-0000-0000-000000000001') AS owns_self,
        public.owns_restaurant('40000000-0000-0000-0000-000000000002') AS owns_other,
        (SELECT count(*)::integer FROM public.review_requests) AS visible_requests
    `)
    assert.deepEqual(access.rows[0], {
      owns_self: true,
      owns_other: false,
      visible_requests: 1,
    })

    await database.exec(`
      INSERT INTO public.review_requests (restaurant_id, customer_email)
      VALUES ('40000000-0000-0000-0000-000000000001', 'new-customer@example.test')
    `)
  } finally {
    await database.exec('COMMIT')
  }

  await database.exec('BEGIN')
  try {
    await setAuthenticatedOwner(
      database,
      '10000000-0000-0000-0000-000000000001',
      'owner-one@example.test',
    )
    await assert.rejects(
      database.exec(`
        INSERT INTO public.review_requests (restaurant_id, customer_email)
        VALUES ('40000000-0000-0000-0000-000000000002', 'blocked@example.test')
      `),
      /row-level security/i,
    )
  } finally {
    await database.exec('ROLLBACK')
  }
})

test('service-role budget tracking, queue claims, review requests, and triggers still work', async () => {
  await database.exec(`
    INSERT INTO public.reviews (
      id, restaurant_id, rating, review_text, google_review_name
    ) VALUES (
      '60000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      5,
      'Excellent service',
      'accounts/test/locations/test/reviews/test'
    );
    INSERT INTO public.reply_queue (
      id, review_id, restaurant_id, generated_reply, scheduled_send_at, sent
    ) VALUES (
      '70000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'Thank you!',
      now() - interval '1 minute',
      false
    );
  `)

  await database.exec('BEGIN')
  try {
    await database.exec('SET LOCAL ROLE service_role')
    const budget = await database.query<{ new_spent_usd: number }>(`
      SELECT new_spent_usd
      FROM public.increment_api_spend(1.25)
    `)
    assert.equal(budget.rows[0].new_spent_usd, 1.25)

    await database.exec(`
      INSERT INTO public.api_usage_log (
        model, operation, input_tokens, output_tokens, cost_usd
      ) VALUES ('test-model', 'security-regression', 10, 5, 1.25);
      INSERT INTO public.review_requests (restaurant_id, customer_email)
      VALUES ('40000000-0000-0000-0000-000000000001', 'service-customer@example.test');
      UPDATE public.business_workspaces
      SET name = 'Owner one workspace updated', updated_at = '2000-01-01T00:00:00Z'
      WHERE id = '30000000-0000-0000-0000-000000000001';
    `)

    const claimed = await database.query<{ id: string }>(`
      SELECT id FROM public.claim_due_replies(1)
    `)
    assert.deepEqual(claimed.rows, [{ id: '70000000-0000-0000-0000-000000000001' }])

    await assert.rejects(
      database.exec(`
        INSERT INTO public.review_requests (restaurant_id, customer_email)
        VALUES ('40000000-0000-0000-0000-000000000001', NULL)
      `),
      /null value in column "customer_email"/i,
    )
  } finally {
    await database.exec('ROLLBACK')
  }

  const unchanged = await database.query<{ spent_usd: number; usage_rows: number; claimed: boolean }>(`
    SELECT
      (SELECT spent_usd FROM public.api_budget_state WHERE id = 'default') AS spent_usd,
      (SELECT count(*)::integer FROM public.api_usage_log WHERE operation = 'security-regression') AS usage_rows,
      (SELECT processing_started_at IS NOT NULL FROM public.reply_queue
       WHERE id = '70000000-0000-0000-0000-000000000001') AS claimed
  `)
  assert.deepEqual(unchanged.rows[0], { spent_usd: 0, usage_rows: 0, claimed: false })

  await database.exec('BEGIN')
  try {
    await database.exec('SET LOCAL ROLE service_role')
    await database.exec(`
      UPDATE public.business_workspaces
      SET name = 'Trigger check', updated_at = '2000-01-01T00:00:00Z'
      WHERE id = '30000000-0000-0000-0000-000000000001'
    `)
    const trigger = await database.query<{ refreshed: boolean }>(`
      SELECT updated_at > '2000-01-02T00:00:00Z'::timestamptz AS refreshed
      FROM public.business_workspaces
      WHERE id = '30000000-0000-0000-0000-000000000001'
    `)
    assert.equal(trigger.rows[0].refreshed, true)
  } finally {
    await database.exec('ROLLBACK')
  }
})
