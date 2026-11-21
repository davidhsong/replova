import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import {
  DEFAULT_TRIAL_PLAN,
  isExistingAuthIdentityError,
  isSameOriginRequest,
  normalizeOnboardingEmail,
  normalizeWorkspaceName,
} from '../lib/accountOnboarding'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '028_account_first_onboarding.sql')
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
    email_confirmed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email text UNIQUE NOT NULL,
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan text NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'agency')),
    stripe_customer_id text,
    terms_accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX accounts_auth_user_id_unique ON accounts (auth_user_id) WHERE auth_user_id IS NOT NULL;

  CREATE TABLE business_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    provisioning_source text NOT NULL DEFAULT 'manual'
      CHECK (provisioning_source IN ('manual', 'legacy_backfill', 'system')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX business_workspaces_legacy_account_unique
    ON business_workspaces (account_id)
    WHERE provisioning_source = 'legacy_backfill';

  CREATE TABLE restaurants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES business_workspaces(id) ON DELETE SET NULL,
    name text NOT NULL,
    place_id text UNIQUE,
    owner_email text NOT NULL,
    active boolean NOT NULL DEFAULT false,
    google_access_token text,
    google_refresh_token text,
    created_at timestamptz NOT NULL DEFAULT now()
  );
`

async function createDatabase(seedSql = '') {
  const database = new PGlite()
  await database.exec(baseSchema)
  if (seedSql.trim()) await database.exec(seedSql)
  await database.exec(await migrationSql)
  return database
}

async function provision(
  database: PGlite,
  userId: string,
  email: string,
  name: string,
  plan: string | null = DEFAULT_TRIAL_PLAN
) {
  const result = await database.query<{
    account_id: string
    workspace_id: string
    account_created: boolean
    workspace_created: boolean
  }>(
    'SELECT * FROM provision_replova_account_workspace($1::uuid, $2, $3, $4)',
    [userId, email, name, plan]
  )
  return result.rows[0]
}

async function provisionWithDatabaseDefault(
  database: PGlite,
  userId: string,
  email: string,
  name: string
) {
  const result = await database.query<{
    account_id: string
    workspace_id: string
    account_created: boolean
    workspace_created: boolean
  }>(
    'SELECT * FROM provision_replova_account_workspace($1::uuid, $2, $3)',
    [userId, email, name]
  )
  return result.rows[0]
}

test('new verified users get an account-only workspace and schema application is inert', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('00000000-0000-0000-0000-000000000101', 'new-owner@example.com', now());
  `)
  t.after(() => database.close())

  const inert = await database.query<{ accounts: number; workspaces: number; restaurants: number }>(`
    SELECT
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces,
      (SELECT count(*)::int FROM restaurants) AS restaurants
  `)
  assert.deepEqual(inert.rows[0], { accounts: 0, workspaces: 0, restaurants: 0 })

  const created = await provisionWithDatabaseDefault(
    database,
    '00000000-0000-0000-0000-000000000101',
    'new-owner@example.com',
    'Cedar Street Wellness'
  )
  assert.equal(created.account_created, true)
  assert.equal(created.workspace_created, true)

  const state = await database.query<{
    owner_email: string
    auth_user_id: string
    plan: string
    workspace_name: string
    source: string
    restaurants: number
  }>(`
    SELECT
      account.owner_email,
      account.auth_user_id,
      account.plan,
      workspace.name AS workspace_name,
      workspace.provisioning_source AS source,
      (SELECT count(*)::int FROM restaurants) AS restaurants
    FROM accounts AS account
    JOIN business_workspaces AS workspace ON workspace.account_id = account.id
  `)
  assert.deepEqual(state.rows[0], {
    owner_email: 'new-owner@example.com',
    auth_user_id: '00000000-0000-0000-0000-000000000101',
    plan: 'growth',
    workspace_name: 'Cedar Street Wellness',
    source: 'system',
    restaurants: 0,
  })
})

test('NULL and invalid provisioning plans are rejected without granting entitlements', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
      ('00000000-0000-0000-0000-000000000111', 'null-plan@example.com', now()),
      ('00000000-0000-0000-0000-000000000112', 'invalid-plan@example.com', now());
  `)
  t.after(() => database.close())

  await assert.rejects(
    provision(
      database,
      '00000000-0000-0000-0000-000000000111',
      'null-plan@example.com',
      'Null Plan Workspace',
      null
    ),
    /invalid_plan/
  )
  await assert.rejects(
    provision(
      database,
      '00000000-0000-0000-0000-000000000112',
      'invalid-plan@example.com',
      'Invalid Plan Workspace',
      'enterprise'
    ),
    /invalid_plan/
  )

  const counts = await database.query<{ accounts: number; workspaces: number }>(`
    SELECT
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces
  `)
  assert.deepEqual(counts.rows[0], { accounts: 0, workspaces: 0 })
})

test('duplicate and concurrent workspace submissions converge on one account and workspace', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('00000000-0000-0000-0000-000000000102', 'retry-owner@example.com', now());
  `)
  t.after(() => database.close())

  const results = await Promise.all([
    provision(database, '00000000-0000-0000-0000-000000000102', 'retry-owner@example.com', 'Harbor Home Services'),
    provision(database, '00000000-0000-0000-0000-000000000102', 'retry-owner@example.com', 'Retry must not rename'),
    provision(database, '00000000-0000-0000-0000-000000000102', 'retry-owner@example.com', 'Third request'),
  ])

  assert.equal(new Set(results.map(result => result.account_id)).size, 1)
  assert.equal(new Set(results.map(result => result.workspace_id)).size, 1)

  const counts = await database.query<{ accounts: number; workspaces: number }>(`
    SELECT
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces
  `)
  assert.deepEqual(counts.rows[0], { accounts: 1, workspaces: 1 })

  const replay = await provision(
    database,
    '00000000-0000-0000-0000-000000000102',
    'retry-owner@example.com',
    'Later replay'
  )
  assert.equal(replay.account_created, false)
  assert.equal(replay.workspace_created, false)
})

test('unverified sessions cannot provision accounts or workspaces', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('00000000-0000-0000-0000-000000000103', 'unverified@example.com', NULL);
  `)
  t.after(() => database.close())

  await assert.rejects(
    provision(
      database,
      '00000000-0000-0000-0000-000000000103',
      'unverified@example.com',
      'Unverified Workspace'
    ),
    /verified_auth_user_required/
  )

  const counts = await database.query<{ accounts: number; workspaces: number }>(`
    SELECT
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces
  `)
  assert.deepEqual(counts.rows[0], { accounts: 0, workspaces: 0 })
})

test('a verified email cannot claim an account owned by another Auth identity', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
      ('00000000-0000-0000-0000-000000000104', 'shared-owner@example.com', now()),
      ('00000000-0000-0000-0000-000000000105', 'SHARED-OWNER@example.com', now());

    INSERT INTO accounts (id, owner_email, auth_user_id, plan)
    VALUES (
      '10000000-0000-0000-0000-000000000104',
      'shared-owner@example.com',
      '00000000-0000-0000-0000-000000000104',
      'starter'
    );
  `)
  t.after(() => database.close())

  await assert.rejects(
    provision(
      database,
      '00000000-0000-0000-0000-000000000105',
      'shared-owner@example.com',
      'Must not be created'
    ),
    /account_owned_by_another_auth_user/
  )

  const state = await database.query<{ accounts: number; workspaces: number; owner_id: string }>(`
    SELECT
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM business_workspaces) AS workspaces,
      (SELECT auth_user_id FROM accounts LIMIT 1) AS owner_id
  `)
  assert.deepEqual(state.rows[0], {
    accounts: 1,
    workspaces: 0,
    owner_id: '00000000-0000-0000-0000-000000000104',
  })
})

test('duplicate normalized-email identities remain unclaimed', async t => {
  const duplicateAuthDatabase = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
      ('00000000-0000-0000-0000-000000000107', 'ambiguous-auth@example.com', now()),
      ('00000000-0000-0000-0000-000000000108', 'AMBIGUOUS-AUTH@example.com', NULL);
  `)
  const duplicateAccountDatabase = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('00000000-0000-0000-0000-000000000109', 'ambiguous-account@example.com', now());

    INSERT INTO accounts (id, owner_email, plan) VALUES
      ('10000000-0000-0000-0000-000000000109', 'ambiguous-account@example.com', 'growth'),
      ('10000000-0000-0000-0000-000000000110', 'AMBIGUOUS-ACCOUNT@example.com', 'agency');
  `)
  t.after(() => Promise.all([duplicateAuthDatabase.close(), duplicateAccountDatabase.close()]))

  await assert.rejects(
    provision(
      duplicateAuthDatabase,
      '00000000-0000-0000-0000-000000000107',
      'ambiguous-auth@example.com',
      'Must not claim duplicate Auth identity'
    ),
    /auth_email_identity_ambiguous/
  )
  await assert.rejects(
    provision(
      duplicateAccountDatabase,
      '00000000-0000-0000-0000-000000000109',
      'ambiguous-account@example.com',
      'Must not claim duplicate account'
    ),
    /account_email_identity_ambiguous/
  )

  for (const database of [duplicateAuthDatabase, duplicateAccountDatabase]) {
    const counts = await database.query<{ workspaces: number; linked_accounts: number }>(`
      SELECT
        (SELECT count(*)::int FROM business_workspaces) AS workspaces,
        (SELECT count(*)::int FROM accounts WHERE auth_user_id IS NOT NULL) AS linked_accounts
    `)
    assert.deepEqual(counts.rows[0], { workspaces: 0, linked_accounts: 0 })
  }
})

test('existing customers retain plan, subscription, workspace, location, and Google data', async t => {
  const database = await createDatabase(`
    INSERT INTO auth.users (id, email, email_confirmed_at)
    VALUES ('00000000-0000-0000-0000-000000000106', 'existing@example.com', now());

    INSERT INTO accounts (id, owner_email, auth_user_id, plan, stripe_customer_id)
    VALUES (
      '10000000-0000-0000-0000-000000000106',
      'existing@example.com',
      '00000000-0000-0000-0000-000000000106',
      'agency',
      'cus_existing'
    );

    INSERT INTO business_workspaces (id, account_id, name, provisioning_source)
    VALUES (
      '30000000-0000-0000-0000-000000000106',
      '10000000-0000-0000-0000-000000000106',
      'Existing Workspace',
      'legacy_backfill'
    );

    INSERT INTO restaurants (
      id, workspace_id, name, place_id, owner_email, active,
      google_access_token, google_refresh_token
    ) VALUES (
      '20000000-0000-0000-0000-000000000106',
      '30000000-0000-0000-0000-000000000106',
      'Existing Location',
      'existing-place',
      'existing@example.com',
      true,
      'access-preserved',
      'refresh-preserved'
    );
  `)
  t.after(() => database.close())

  const result = await provision(
    database,
    '00000000-0000-0000-0000-000000000106',
    'existing@example.com',
    'Attempted Rename',
    'starter'
  )
  assert.equal(result.account_created, false)
  assert.equal(result.workspace_created, false)
  assert.equal(result.workspace_id, '30000000-0000-0000-0000-000000000106')

  const preserved = await database.query<{
    plan: string
    stripe_customer_id: string
    workspace_name: string
    access_token: string
    refresh_token: string
  }>(`
    SELECT
      account.plan,
      account.stripe_customer_id,
      workspace.name AS workspace_name,
      restaurant.google_access_token AS access_token,
      restaurant.google_refresh_token AS refresh_token
    FROM accounts AS account
    JOIN business_workspaces AS workspace ON workspace.account_id = account.id
    JOIN restaurants AS restaurant ON restaurant.workspace_id = workspace.id
  `)
  assert.deepEqual(preserved.rows[0], {
    plan: 'agency',
    stripe_customer_id: 'cus_existing',
    workspace_name: 'Existing Workspace',
    access_token: 'access-preserved',
    refresh_token: 'refresh-preserved',
  })
})

test('provisioning RPC is server-only and application routes enforce auth and CSRF', async t => {
  const database = await createDatabase()
  t.after(() => database.close())

  const privileges = await database.query<{ role_name: string; can_execute: boolean }>(`
    SELECT role_name, has_function_privilege(
      role_name,
      'provision_replova_account_workspace(uuid,text,text,text)',
      'EXECUTE'
    ) AS can_execute
    FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
    ORDER BY role_name
  `)
  assert.deepEqual(privileges.rows, [
    { role_name: 'anon', can_execute: false },
    { role_name: 'authenticated', can_execute: false },
    { role_name: 'service_role', can_execute: true },
  ])

  const signupRoute = await readFile(path.join(repoRoot, 'app', 'api', 'auth', 'signup', 'route.ts'), 'utf8')
  const workspaceRoute = await readFile(path.join(repoRoot, 'app', 'api', 'onboarding', 'workspace', 'route.ts'), 'utf8')
  const locationRoute = await readFile(path.join(repoRoot, 'app', 'api', 'restaurants', 'create', 'route.ts'), 'utf8')
  const placeSearchRoute = await readFile(path.join(repoRoot, 'app', 'api', 'onboard', 'search-place', 'route.ts'), 'utf8')
  const magicLinkRoute = await readFile(path.join(repoRoot, 'app', 'api', 'auth', 'magic-link', 'route.ts'), 'utf8')
  const sessionRoute = await readFile(path.join(repoRoot, 'app', 'api', 'auth', 'session', 'route.ts'), 'utf8')
  const createCheckoutRoute = await readFile(path.join(repoRoot, 'app', 'api', 'create-checkout', 'route.ts'), 'utf8')
  const checkoutSuccessRoute = await readFile(path.join(repoRoot, 'app', 'api', 'checkout-success', 'route.ts'), 'utf8')
  const stripeWebhookRoute = await readFile(path.join(repoRoot, 'app', 'api', 'webhooks', 'stripe', 'route.ts'), 'utf8')
  const dashboardPage = await readFile(path.join(repoRoot, 'app', 'dashboard', 'reviews', 'page.tsx'), 'utf8')

  assert.match(signupRoute, /email_confirm:\s*false/)
  assert.match(signupRoute, /shouldCreateUser:\s*false/)
  assert.match(signupRoute, /isSameOriginRequest\(request\)/)
  assert.doesNotMatch(signupRoute, /\.from\(['"]accounts['"]\)[\s\S]*\.insert/)
  assert.doesNotMatch(signupRoute, /body\.plan/)

  assert.match(workspaceRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(workspaceRoute, /user\.email_confirmed_at/)
  assert.match(workspaceRoute, /isSameOriginRequest\(request\)/)
  assert.match(workspaceRoute, /p_auth_user_id:\s*user\.id/)
  assert.match(workspaceRoute, /p_verified_email:\s*user\.email/)
  assert.match(workspaceRoute, /p_plan:\s*DEFAULT_TRIAL_PLAN/)
  assert.doesNotMatch(workspaceRoute, /body\.email/)
  assert.doesNotMatch(workspaceRoute, /body\.plan/)

  assert.match(locationRoute, /isSameOriginRequest\(request\)/)
  assert.match(locationRoute, /account\.auth_user_id !== user\.id/)
  assert.match(locationRoute, /getPlanLimits\(account\.plan\)/)
  assert.match(locationRoute, /workspace_id:\s*workspace\.id/)
  assert.doesNotMatch(locationRoute, /body\.email/)
  assert.match(placeSearchRoute, /supabase\.auth\.getUser\(\)/)
  assert.match(placeSearchRoute, /user\.email_confirmed_at/)
  assert.match(magicLinkRoute, /isSameOriginRequest\(req\)/)
  assert.match(sessionRoute, /isSameOriginRequest\(request\)/)
  assert.match(createCheckoutRoute, /line_items:\s*\[\{\s*price:\s*getStripePriceId\(plan\)/)
  assert.doesNotMatch(createCheckoutRoute, /\.from\(['"]accounts['"]\)[\s\S]*\.update\(\{\s*plan/)
  assert.match(checkoutSuccessRoute, /getPlanFromStripePrice\(subscription\.items\.data\[0\]\?\.price\.id/)
  assert.doesNotMatch(checkoutSuccessRoute, /resolvePlan\(session\.metadata\?\.plan\)/)
  assert.match(stripeWebhookRoute, /const plan = getPlanFromStripePrice\(subscription\.items\.data\[0\]\?\.price\.id/)
  assert.doesNotMatch(stripeWebhookRoute, /plan:\s*resolvePlan\(session\.metadata\?\.plan\)/)
  assert.match(dashboardPage, /WorkspaceEmptyState/)
})

test('onboarding validation normalizes safe inputs and rejects invalid values', () => {
  assert.equal(normalizeOnboardingEmail('  Owner@Example.COM  '), 'owner@example.com')
  assert.equal(normalizeOnboardingEmail('not-an-email'), null)
  assert.equal(normalizeWorkspaceName('  Cedar   Street   Wellness  '), 'Cedar Street Wellness')
  assert.equal(normalizeWorkspaceName(' '), null)
  assert.equal(DEFAULT_TRIAL_PLAN, 'growth')
  assert.equal(isExistingAuthIdentityError('User already registered'), true)
  assert.equal(isExistingAuthIdentityError('Network timeout'), false)
  assert.equal(isSameOriginRequest(new Request('https://www.replova.app/api/onboarding/workspace', {
    headers: { Origin: 'https://www.replova.app' },
  })), true)
  assert.equal(isSameOriginRequest(new Request('https://www.replova.app/api/onboarding/workspace', {
    headers: { Origin: 'https://attacker.example' },
  })), false)
  assert.equal(isSameOriginRequest(new Request('https://www.replova.app/api/onboarding/workspace')), false)
})
