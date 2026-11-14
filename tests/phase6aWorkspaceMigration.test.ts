import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(
  repoRoot,
  'supabase',
  'migrations',
  '027_business_workspace_foundation.sql'
)

const migrationSql = readFile(migrationPath, 'utf8')

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
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULL::uuid $$;

  CREATE FUNCTION auth.email() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULL::text $$;

  CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email text UNIQUE NOT NULL,
    plan text NOT NULL DEFAULT 'starter'
      CHECK (plan IN ('starter', 'growth', 'agency')),
    stripe_customer_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    terms_accepted_at timestamptz
  );

  CREATE TABLE restaurants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    place_id text NOT NULL UNIQUE,
    owner_email text NOT NULL,
    active boolean NOT NULL DEFAULT false,
    google_access_token text,
    google_refresh_token text,
    google_token_expires_at bigint,
    google_location_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    report_logo_url text
  );

  ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
`

type TestDatabase = PGlite

async function createMigratedDatabase(seedSql = ''): Promise<TestDatabase> {
  const database = new PGlite()
  await database.exec(baseSchema)
  if (seedSql.trim()) await database.exec(seedSql)
  await database.exec(await migrationSql)
  return database
}

async function preview(database: TestDatabase) {
  const result = await database.query<{ preview: Record<string, number> }>(
    'SELECT preview_phase6a_workspace_backfill() AS preview'
  )
  return result.rows[0].preview
}

async function runBackfill(database: TestDatabase, actor: string) {
  const result = await database.query<{
    result: {
      status: string
      summary: Record<string, number | Record<string, number>>
    }
  }>('SELECT run_phase6a_workspace_backfill($1) AS result', [actor])
  return result.rows[0].result
}

test('duplicate account emails are conflicts while independent identities continue', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO auth.users (id, email) VALUES
      ('00000000-0000-0000-0000-000000000001', 'duplicate@example.com'),
      ('00000000-0000-0000-0000-000000000002', 'valid@example.com');

    INSERT INTO accounts (id, owner_email, plan, stripe_customer_id) VALUES
      ('10000000-0000-0000-0000-000000000001', 'Duplicate@example.com', 'starter', NULL),
      ('10000000-0000-0000-0000-000000000002', 'duplicate@example.com', 'growth', NULL),
      ('10000000-0000-0000-0000-000000000003', 'valid@example.com', 'agency', 'cus_preserved');

    INSERT INTO restaurants (
      id, name, place_id, owner_email, google_access_token
    ) VALUES
      ('20000000-0000-0000-0000-000000000001', 'Ambiguous location', 'place-ambiguous', 'duplicate@example.com', NULL),
      ('20000000-0000-0000-0000-000000000002', 'Valid location', 'place-valid', 'valid@example.com', 'token-preserved');
  `)
  t.after(() => database.close())

  const before = await preview(database)
  assert.equal(before.account_auth_links_ready, 1)
  assert.equal(before.account_auth_link_conflicts, 2)
  assert.equal(before.duplicate_account_email_groups, 1)
  assert.equal(before.duplicate_account_email_accounts, 2)
  assert.equal(before.locations_to_link, 1)
  assert.equal(before.ambiguous_account_locations, 1)

  const result = await runBackfill(database, 'duplicate-account-test')
  assert.equal(result.status, 'completed')
  assert.equal(result.summary.auth_users_linked, 1)
  assert.equal(result.summary.workspaces_created, 3)
  assert.equal(result.summary.locations_linked, 1)

  const state = await database.query<{
    duplicate_links: number
    valid_links: number
    ambiguous_locations: number
    valid_locations: number
    stripe_customer: string
    access_token: string
  }>(`
    SELECT
      (SELECT count(*)::int FROM accounts
       WHERE lower(owner_email) = 'duplicate@example.com' AND auth_user_id IS NOT NULL) AS duplicate_links,
      (SELECT count(*)::int FROM accounts
       WHERE owner_email = 'valid@example.com' AND auth_user_id IS NOT NULL) AS valid_links,
      (SELECT count(*)::int FROM restaurants
       WHERE place_id = 'place-ambiguous' AND workspace_id IS NOT NULL) AS ambiguous_locations,
      (SELECT count(*)::int FROM restaurants
       WHERE place_id = 'place-valid' AND workspace_id IS NOT NULL) AS valid_locations,
      (SELECT stripe_customer_id FROM accounts WHERE owner_email = 'valid@example.com') AS stripe_customer,
      (SELECT google_access_token FROM restaurants WHERE place_id = 'place-valid') AS access_token
  `)

  assert.deepEqual(state.rows[0], {
    duplicate_links: 0,
    valid_links: 1,
    ambiguous_locations: 0,
    valid_locations: 1,
    stripe_customer: 'cus_preserved',
    access_token: 'token-preserved',
  })
})

test('duplicate Auth emails are conflicts and do not block a valid partial backfill', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO auth.users (id, email) VALUES
      ('00000000-0000-0000-0000-000000000011', 'auth-duplicate@example.com'),
      ('00000000-0000-0000-0000-000000000012', 'AUTH-DUPLICATE@example.com'),
      ('00000000-0000-0000-0000-000000000013', 'valid-partial@example.com');

    INSERT INTO accounts (id, owner_email) VALUES
      ('10000000-0000-0000-0000-000000000011', 'auth-duplicate@example.com'),
      ('10000000-0000-0000-0000-000000000012', 'valid-partial@example.com');
  `)
  t.after(() => database.close())

  const before = await preview(database)
  assert.equal(before.account_auth_links_ready, 1)
  assert.equal(before.account_auth_link_conflicts, 1)
  assert.equal(before.duplicate_auth_email_groups, 1)
  assert.equal(before.duplicate_auth_email_accounts, 1)

  const result = await runBackfill(database, 'duplicate-auth-test')
  assert.equal(result.status, 'completed')
  assert.equal(result.summary.auth_users_linked, 1)

  const links = await database.query<{ email: string; auth_user_id: string | null }>(`
    SELECT owner_email AS email, auth_user_id
    FROM accounts
    ORDER BY owner_email
  `)
  assert.equal(links.rows.find(row => row.email === 'auth-duplicate@example.com')?.auth_user_id, null)
  assert.ok(links.rows.find(row => row.email === 'valid-partial@example.com')?.auth_user_id)
})

test('an account with no Auth user remains unresolved without failing', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO accounts (id, owner_email)
    VALUES ('10000000-0000-0000-0000-000000000021', 'missing-auth@example.com');
  `)
  t.after(() => database.close())

  const before = await preview(database)
  assert.equal(before.account_auth_links_unresolved, 1)
  assert.equal(before.account_auth_link_conflicts, 0)

  const result = await runBackfill(database, 'missing-auth-test')
  assert.equal(result.status, 'completed')
  assert.equal(result.summary.auth_users_linked, 0)
  assert.equal(result.summary.workspaces_created, 1)

  const account = await database.query<{ auth_user_id: string | null }>(
    "SELECT auth_user_id FROM accounts WHERE owner_email = 'missing-auth@example.com'"
  )
  assert.equal(account.rows[0].auth_user_id, null)
})

test('a location is skipped when its uniquely owned account has multiple workspaces', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO auth.users (id, email)
    VALUES ('00000000-0000-0000-0000-000000000031', 'multi-workspace@example.com');

    INSERT INTO accounts (id, owner_email)
    VALUES ('10000000-0000-0000-0000-000000000031', 'multi-workspace@example.com');

    INSERT INTO restaurants (id, name, place_id, owner_email)
    VALUES (
      '20000000-0000-0000-0000-000000000031',
      'Multi-workspace location',
      'place-multi-workspace',
      'multi-workspace@example.com'
    );
  `)
  t.after(() => database.close())

  await database.exec(`
    INSERT INTO business_workspaces (account_id, name) VALUES
      ('10000000-0000-0000-0000-000000000031', 'Workspace one'),
      ('10000000-0000-0000-0000-000000000031', 'Workspace two');
  `)

  const before = await preview(database)
  assert.equal(before.locations_to_link, 0)
  assert.equal(before.ambiguous_workspace_locations, 1)

  const result = await runBackfill(database, 'multi-workspace-test')
  assert.equal(result.status, 'completed')
  assert.equal(result.summary.workspaces_created, 0)
  assert.equal(result.summary.locations_linked, 0)

  const location = await database.query<{ workspace_id: string | null }>(
    "SELECT workspace_id FROM restaurants WHERE place_id = 'place-multi-workspace'"
  )
  assert.equal(location.rows[0].workspace_id, null)
})

test('an orphan location remains untouched and is reported once', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO restaurants (id, name, place_id, owner_email)
    VALUES (
      '20000000-0000-0000-0000-000000000041',
      'Orphan location',
      'place-orphan',
      'orphan@example.com'
    );
  `)
  t.after(() => database.close())

  const before = await preview(database)
  assert.equal(before.orphan_locations, 1)
  assert.equal(before.locations_to_link, 0)

  const result = await runBackfill(database, 'orphan-test')
  assert.equal(result.status, 'completed')
  assert.equal(result.summary.locations_linked, 0)

  const location = await database.query<{ workspace_id: string | null }>(
    "SELECT workspace_id FROM restaurants WHERE place_id = 'place-orphan'"
  )
  assert.equal(location.rows[0].workspace_id, null)
})

test('schema application is inert and repeated backfill execution is idempotent', async t => {
  const database = await createMigratedDatabase(`
    INSERT INTO auth.users (id, email)
    VALUES ('00000000-0000-0000-0000-000000000051', 'repeat@example.com');

    INSERT INTO accounts (id, owner_email)
    VALUES ('10000000-0000-0000-0000-000000000051', 'repeat@example.com');

    INSERT INTO restaurants (id, name, place_id, owner_email)
    VALUES (
      '20000000-0000-0000-0000-000000000051',
      'Repeat location',
      'place-repeat',
      'repeat@example.com'
    );
  `)
  t.after(() => database.close())

  const afterSchema = await database.query<{
    linked_accounts: number
    workspaces: number
    linked_locations: number
    runs: number
  }>(`
    SELECT
      (SELECT count(*)::int FROM accounts WHERE auth_user_id IS NOT NULL) AS linked_accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces,
      (SELECT count(*)::int FROM restaurants WHERE workspace_id IS NOT NULL) AS linked_locations,
      (SELECT count(*)::int FROM phase6a_backfill_runs) AS runs
  `)
  assert.deepEqual(afterSchema.rows[0], {
    linked_accounts: 0,
    workspaces: 0,
    linked_locations: 0,
    runs: 0,
  })

  const first = await runBackfill(database, 'first-run')
  const second = await runBackfill(database, 'second-run')
  assert.equal(first.status, 'completed')
  assert.equal(first.summary.auth_users_linked, 1)
  assert.equal(first.summary.workspaces_created, 1)
  assert.equal(first.summary.locations_linked, 1)
  assert.equal(second.status, 'completed')
  assert.equal(second.summary.auth_users_linked, 0)
  assert.equal(second.summary.workspaces_created, 0)
  assert.equal(second.summary.locations_linked, 0)

  const finalState = await database.query<{
    workspaces: number
    runs: number
    events: number
  }>(`
    SELECT
      (SELECT count(*)::int FROM business_workspaces) AS workspaces,
      (SELECT count(*)::int FROM phase6a_backfill_runs) AS runs,
      (SELECT count(*)::int FROM phase6a_backfill_events) AS events
  `)
  assert.deepEqual(finalState.rows[0], { workspaces: 1, runs: 2, events: 3 })
})

async function listSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(entryPath)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : []
  }))
  return files.flat()
}

test('all application accounts access remains on the service-role client', async () => {
  const sourceFiles = [
    ...await listSourceFiles(path.join(repoRoot, 'app')),
    ...await listSourceFiles(path.join(repoRoot, 'lib')),
  ]
  const accountAccessFiles: string[] = []

  for (const sourcePath of sourceFiles) {
    const source = await readFile(sourcePath, 'utf8')
    if (!/\.from\(['"]accounts['"]\)/.test(source)) continue

    accountAccessFiles.push(path.relative(repoRoot, sourcePath))
    const usesSharedAdmin = source.includes('getSupabaseAdmin')
    const usesLocalAdmin = source.includes('getAdminClient')
      && source.includes('SUPABASE_SERVICE_ROLE_KEY')

    assert.equal(
      usesSharedAdmin || usesLocalAdmin,
      true,
      `${path.relative(repoRoot, sourcePath)} accesses accounts without a service-role admin client`
    )
    assert.equal(
      source.includes("getSupabaseBrowser().from('accounts')"),
      false,
      `${path.relative(repoRoot, sourcePath)} accesses accounts from the browser client`
    )
  }

  assert.ok(accountAccessFiles.length > 0, 'expected to audit at least one accounts access')
})
