import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PGlite } from '@electric-sql/pglite'
import {
  decryptGoogleBusinessToken,
  encryptGoogleBusinessToken,
  rotateGoogleBusinessTokenIfNeeded,
} from '../lib/googleBusinessTokens'
import {
  getValidGoogleBusinessAccessToken,
  GoogleBusinessAuthorizationError,
} from '../lib/googleBusinessConnection'
import {
  GoogleLocationsError,
  listGoogleBusinessLocations,
  selectAuthorizedGoogleBusinessLocations,
} from '../lib/googleLocations'
import { accountCanActivateNewLocations } from '../lib/accountEntitlements'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '029_workspace_google_business_connections.sql')
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

  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

  CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_email text UNIQUE NOT NULL,
    auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    plan text NOT NULL CHECK (plan IN ('starter', 'growth', 'agency')),
    stripe_customer_id text,
    terms_accepted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE business_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    provisioning_source text NOT NULL DEFAULT 'system',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE restaurants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid REFERENCES business_workspaces(id) ON DELETE SET NULL,
    name text NOT NULL,
    place_id text UNIQUE,
    owner_email text NOT NULL,
    active boolean NOT NULL DEFAULT false,
    cuisine_type text,
    report_logo_url text,
    google_access_token text,
    google_refresh_token text,
    google_token_expires_at bigint,
    google_location_name text,
    created_at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE restaurant_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL UNIQUE REFERENCES restaurants(id) ON DELETE CASCADE
  );

  CREATE FUNCTION set_replova_workspace_updated_at() RETURNS trigger
  LANGUAGE plpgsql AS $$
  BEGIN
    NEW.updated_at := now();
    RETURN NEW;
  END;
  $$;

  CREATE FUNCTION current_user_owns_replova_workspace(p_workspace_id uuid) RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT false $$;
`

const ids = {
  user: '00000000-0000-0000-0000-000000000301',
  otherUser: '00000000-0000-0000-0000-000000000302',
  account: '10000000-0000-0000-0000-000000000301',
  otherAccount: '10000000-0000-0000-0000-000000000302',
  workspace: '20000000-0000-0000-0000-000000000301',
  otherWorkspace: '20000000-0000-0000-0000-000000000302',
  connection: '30000000-0000-0000-0000-000000000301',
  otherConnection: '30000000-0000-0000-0000-000000000302',
}

async function createDatabase(plan = 'growth') {
  const database = new PGlite()
  await database.exec(baseSchema)
  await database.exec(`
    INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
      ('${ids.user}', 'owner@example.com', now()),
      ('${ids.otherUser}', 'other@example.com', now());
    INSERT INTO accounts (id, owner_email, auth_user_id, plan) VALUES
      ('${ids.account}', 'owner@example.com', '${ids.user}', '${plan}'),
      ('${ids.otherAccount}', 'other@example.com', '${ids.otherUser}', 'agency');
    INSERT INTO business_workspaces (id, account_id, name) VALUES
      ('${ids.workspace}', '${ids.account}', 'Owner Workspace'),
      ('${ids.otherWorkspace}', '${ids.otherAccount}', 'Other Workspace');
  `)
  await database.exec(await migrationSql)
  await database.exec(`
    INSERT INTO google_business_connections (
      id, workspace_id, connected_by_auth_user_id, google_subject, access_token_encrypted,
      refresh_token_encrypted, token_expires_at, granted_scopes
    ) VALUES
      ('${ids.connection}', '${ids.workspace}', '${ids.user}', 'google-owner-subject', 'encrypted-access', 'encrypted-refresh', 4102444800000,
       ARRAY['https://www.googleapis.com/auth/business.manage']),
      ('${ids.otherConnection}', '${ids.otherWorkspace}', '${ids.otherUser}', 'google-other-subject', 'other-access', 'other-refresh', 4102444800000,
       ARRAY['https://www.googleapis.com/auth/business.manage']);
  `)
  return database
}

const defaultLocations = [
  {
    accountResourceName: 'accounts/111',
    accountId: '111',
    locationResourceName: 'locations/aaa',
    locationId: 'aaa',
    reviewResourceName: 'accounts/111/locations/aaa',
    title: 'North Location',
    placeId: null,
  },
  {
    accountResourceName: 'accounts/222',
    accountId: '222',
    locationResourceName: 'locations/bbb',
    locationId: 'bbb',
    reviewResourceName: 'accounts/222/locations/bbb',
    title: 'South Location',
    placeId: 'place-south',
  },
]

async function linkLocationPayload(
  database: PGlite,
  locations: typeof defaultLocations,
  options: {
    userId?: string
    workspaceId?: string
    connectionId?: string
    googleSubject?: string
    activate?: boolean
  } = {}
) {
  const workspaceId = options.workspaceId ?? ids.workspace
  return database.query<{
    location_link_id: string
    linked_restaurant_id: string
    linked_review_resource_name: string
    restaurant_created: boolean
  }>(
    'SELECT * FROM link_google_business_locations($1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6)',
    [
      workspaceId,
      options.userId ?? ids.user,
      options.connectionId ?? (workspaceId === ids.workspace ? ids.connection : ids.otherConnection),
      options.googleSubject ?? (workspaceId === ids.workspace ? 'google-owner-subject' : 'google-other-subject'),
      JSON.stringify(locations),
      options.activate ?? false,
    ]
  )
}

async function linkLocations(database: PGlite, userId = ids.user, workspaceId = ids.workspace) {
  return linkLocationPayload(database, defaultLocations, { userId, workspaceId })
}

test('migration 029 is additive, idempotent, and preserves legacy data', async t => {
  const database = new PGlite()
  t.after(() => database.close())
  await database.exec(baseSchema)
  await database.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${ids.user}', 'owner@example.com');
    INSERT INTO accounts (id, owner_email, auth_user_id, plan, stripe_customer_id)
      VALUES ('${ids.account}', 'owner@example.com', '${ids.user}', 'agency', 'cus_preserved');
    INSERT INTO business_workspaces (id, account_id, name)
      VALUES ('${ids.workspace}', '${ids.account}', 'Preserved Workspace');
    INSERT INTO restaurants (
      workspace_id, name, place_id, owner_email, active, google_access_token,
      google_refresh_token, google_token_expires_at, google_location_name
    ) VALUES (
      '${ids.workspace}', 'Preserved Location', 'preserved-place', 'owner@example.com', true,
      'plaintext-access-preserved', 'plaintext-refresh-preserved', 12345,
      'accounts/legacy/locations/legacy'
    );
  `)

  await database.exec(await migrationSql)
  await database.exec(await migrationSql)

  const state = await database.query<{
    plan: string
    stripe_customer_id: string
    legacy_access: string
    legacy_refresh: string
    canonical_location_id: string | null
    new_connections: number
    new_links: number
  }>(`
    SELECT
      account.plan,
      account.stripe_customer_id,
      restaurant.google_access_token AS legacy_access,
      restaurant.google_refresh_token AS legacy_refresh,
      restaurant.google_business_location_id AS canonical_location_id,
      (SELECT count(*)::int FROM google_business_connections) AS new_connections,
      (SELECT count(*)::int FROM google_business_locations) AS new_links
    FROM accounts account
    JOIN restaurants restaurant ON restaurant.workspace_id = '${ids.workspace}'
  `)
  assert.deepEqual(state.rows[0], {
    plan: 'agency',
    stripe_customer_id: 'cus_preserved',
    legacy_access: 'plaintext-access-preserved',
    legacy_refresh: 'plaintext-refresh-preserved',
    canonical_location_id: null,
    new_connections: 0,
    new_links: 0,
  })
})

test('OAuth state is bound to one user, expires, and is consumed exactly once', async t => {
  const database = await createDatabase()
  t.after(() => database.close())
  const validHash = 'a'.repeat(64)
  const expiredHash = 'b'.repeat(64)
  await database.query(`
    INSERT INTO google_business_oauth_states
      (state_hash, workspace_id, auth_user_id, created_at, expires_at)
    VALUES
      ($1, '${ids.workspace}', '${ids.user}', now(), now() + interval '10 minutes'),
      ($2, '${ids.workspace}', '${ids.user}', now() - interval '20 minutes', now() - interval '10 minutes')
  `, [validHash, expiredHash])

  await assert.rejects(
    database.query('SELECT * FROM consume_google_business_oauth_state($1, $2::uuid)', [validHash, ids.otherUser]),
    /oauth_state_invalid_expired_or_replayed/
  )
  await assert.rejects(
    database.query('SELECT * FROM consume_google_business_oauth_state($1, $2::uuid)', [expiredHash, ids.user]),
    /oauth_state_invalid_expired_or_replayed/
  )

  const consumed = await database.query<{ workspace_id: string }>(
    'SELECT * FROM consume_google_business_oauth_state($1, $2::uuid)',
    [validHash, ids.user]
  )
  assert.equal(consumed.rows[0].workspace_id, ids.workspace)
  await assert.rejects(
    database.query('SELECT * FROM consume_google_business_oauth_state($1, $2::uuid)', [validHash, ids.user]),
    /oauth_state_invalid_expired_or_replayed/
  )
})

test('multi-location linking preserves exact resources, deduplicates retries, and blocks cross-workspace access', async t => {
  const database = await createDatabase('growth')
  t.after(() => database.close())

  const first = await linkLocations(database)
  assert.equal(first.rows.length, 2)
  assert.equal(first.rows.every(row => row.restaurant_created), true)
  assert.deepEqual(first.rows.map(row => row.linked_review_resource_name), [
    'accounts/111/locations/aaa',
    'accounts/222/locations/bbb',
  ])

  const retry = await linkLocations(database)
  assert.equal(retry.rows.length, 2)
  assert.equal(retry.rows.every(row => !row.restaurant_created), true)

  const counts = await database.query<{ restaurants: number; links: number; settings: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS links,
      (SELECT count(*)::int FROM restaurant_settings) AS settings
  `)
  assert.deepEqual(counts.rows[0], { restaurants: 2, links: 2, settings: 2 })

  await assert.rejects(
    linkLocations(database, ids.otherUser, ids.workspace),
    /workspace_not_owned/
  )
})

test('one Google location exposed through multiple accounts creates one internal location and preserves both review parents', async t => {
  const database = await createDatabase('growth')
  t.after(() => database.close())
  const sharedLocationResources = [
    {
      accountResourceName: 'accounts/111',
      accountId: '111',
      locationResourceName: 'locations/shared-null-place',
      locationId: 'shared-null-place',
      reviewResourceName: 'accounts/111/locations/shared-null-place',
      title: 'Shared Service Area',
      placeId: null,
    },
    {
      accountResourceName: 'accounts/222',
      accountId: '222',
      locationResourceName: 'locations/shared-null-place',
      locationId: 'shared-null-place',
      reviewResourceName: 'accounts/222/locations/shared-null-place',
      title: 'Shared Service Area',
      placeId: null,
    },
  ]

  const linked = await linkLocationPayload(database, sharedLocationResources)
  assert.equal(linked.rows.length, 2)
  assert.equal(new Set(linked.rows.map(row => row.linked_restaurant_id)).size, 1)
  assert.equal(linked.rows.filter(row => row.restaurant_created).length, 1)

  const state = await database.query<{
    restaurants: number
    associations: number
    canonical_id: string
    review_parents: string[]
  }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS associations,
      (SELECT google_business_location_id FROM restaurants WHERE workspace_id = '${ids.workspace}') AS canonical_id,
      (SELECT array_agg(review_parent_resource_name ORDER BY review_parent_resource_name)
       FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS review_parents
  `)
  assert.deepEqual(state.rows[0], {
    restaurants: 1,
    associations: 2,
    canonical_id: 'shared-null-place',
    review_parents: [
      'accounts/111/locations/shared-null-place',
      'accounts/222/locations/shared-null-place',
    ],
  })

  const retry = await linkLocationPayload(database, sharedLocationResources)
  assert.equal(retry.rows.every(row => !row.restaurant_created), true)
  const retryCounts = await database.query<{ restaurants: number; associations: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS associations
  `)
  assert.deepEqual(retryCounts.rows[0], { restaurants: 1, associations: 2 })
})

test('invalid resources, duplicate requests, and stale connection identities fail atomically', async t => {
  const database = await createDatabase('agency')
  t.after(() => database.close())
  const invalid = [{
    ...defaultLocations[0],
    locationResourceName: 'locations/fabricated',
  }]
  await assert.rejects(linkLocationPayload(database, invalid), /invalid_google_location_resource/)
  await assert.rejects(
    linkLocationPayload(database, [defaultLocations[0], defaultLocations[0]]),
    /duplicate_google_location_resource/
  )
  await assert.rejects(
    linkLocationPayload(database, [defaultLocations[0]], { googleSubject: 'stale-google-subject' }),
    /google_business_connection_required/
  )
  const counts = await database.query<{ restaurants: number; links: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS links
  `)
  assert.deepEqual(counts.rows[0], { restaurants: 0, links: 0 })
})

test('concurrent account-specific selections converge on one canonical internal location', async t => {
  const database = await createDatabase('growth')
  t.after(() => database.close())
  const first = [{
    accountResourceName: 'accounts/111',
    accountId: '111',
    locationResourceName: 'locations/concurrent-shared',
    locationId: 'concurrent-shared',
    reviewResourceName: 'accounts/111/locations/concurrent-shared',
    title: 'Concurrent Shared Location',
    placeId: null,
  }]
  const second = [{
    ...first[0],
    accountResourceName: 'accounts/222',
    accountId: '222',
    reviewResourceName: 'accounts/222/locations/concurrent-shared',
  }]

  await Promise.all([
    linkLocationPayload(database, first),
    linkLocationPayload(database, second),
  ])
  const counts = await database.query<{ restaurants: number; associations: number; settings: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS associations,
      (SELECT count(*)::int FROM restaurant_settings) AS settings
  `)
  assert.deepEqual(counts.rows[0], { restaurants: 1, associations: 2, settings: 1 })
})

test('concurrent distinct selections cannot exceed the subscription location limit', async t => {
  const database = await createDatabase('starter')
  t.after(() => database.close())
  const results = await Promise.allSettled([
    linkLocationPayload(database, [defaultLocations[0]]),
    linkLocationPayload(database, [defaultLocations[1]]),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const rejected = results.find(result => result.status === 'rejected')
  assert.ok(rejected && rejected.status === 'rejected')
  assert.match(String(rejected.reason), /subscription_location_limit_exceeded/)

  const counts = await database.query<{ restaurants: number; associations: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS associations
  `)
  assert.deepEqual(counts.rows[0], { restaurants: 1, associations: 1 })
})

test('expired trials create inactive locations and activation is derived from trusted entitlement state', async t => {
  const database = await createDatabase('agency')
  t.after(() => database.close())
  const expiredAccount = {
    stripe_customer_id: null,
    created_at: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
  }
  const validTrialAccount = {
    stripe_customer_id: null,
    created_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
  }
  assert.equal(await accountCanActivateNewLocations(expiredAccount), false)
  assert.equal(await accountCanActivateNewLocations(validTrialAccount), true)

  await linkLocationPayload(database, [defaultLocations[0]], {
    activate: await accountCanActivateNewLocations(expiredAccount),
  })
  const restaurant = await database.query<{ active: boolean; plan: string }>(`
    SELECT restaurant.active, account.plan
    FROM restaurants restaurant
    JOIN business_workspaces workspace ON workspace.id = restaurant.workspace_id
    JOIN accounts account ON account.id = workspace.account_id
    WHERE restaurant.workspace_id = '${ids.workspace}'
  `)
  assert.deepEqual(restaurant.rows[0], { active: false, plan: 'agency' })

  const entitlementSource = await readFile(path.join(repoRoot, 'lib/accountEntitlements.ts'), 'utf8')
  const selectionRoute = await readFile(path.join(repoRoot, 'app/api/auth/google/set-location/route.ts'), 'utf8')
  assert.match(entitlementSource, /getStripe\(\)\.subscriptions\.list/)
  assert.match(entitlementSource, /subscriptionGrantsAccess/)
  assert.match(selectionRoute, /accountCanActivateNewLocations\(context\.account\)/)
  assert.doesNotMatch(selectionRoute, /context\.account\.plan\s*===/)
})

test('legacy locations are linked without duplication and plan limits fail atomically', async t => {
  const starterDatabase = await createDatabase('starter')
  const legacyDatabase = await createDatabase('growth')
  t.after(() => Promise.all([starterDatabase.close(), legacyDatabase.close()]))

  await assert.rejects(linkLocations(starterDatabase), /subscription_location_limit_exceeded/)
  const starterCounts = await starterDatabase.query<{ restaurants: number; links: number }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}') AS links
  `)
  assert.deepEqual(starterCounts.rows[0], { restaurants: 0, links: 0 })

  await legacyDatabase.exec(`
    INSERT INTO restaurants (
      id, workspace_id, name, place_id, owner_email, active, google_location_name
    ) VALUES (
      '40000000-0000-0000-0000-000000000301', '${ids.workspace}', 'Existing South',
      'place-south', 'owner@example.com', true, 'locations/bbb'
    );
  `)
  const linked = await linkLocations(legacyDatabase)
  const south = linked.rows.find(row => row.linked_review_resource_name.endsWith('/bbb'))
  assert.equal(south?.linked_restaurant_id, '40000000-0000-0000-0000-000000000301')
  assert.equal(south?.restaurant_created, false)
  const legacyCounts = await legacyDatabase.query<{ restaurants: number; full_parent: string }>(`
    SELECT
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT google_location_name FROM restaurants WHERE id = '40000000-0000-0000-0000-000000000301') AS full_parent
  `)
  assert.deepEqual(legacyCounts.rows[0], {
    restaurants: 2,
    full_parent: 'accounts/222/locations/bbb',
  })
})

test('disconnect is ownership-bound, atomic, scoped, and preserves durable location records', async t => {
  const database = await createDatabase('growth')
  t.after(() => database.close())
  await linkLocations(database)
  await database.exec(`
    UPDATE restaurants
    SET google_access_token = 'legacy-access', google_refresh_token = 'legacy-refresh'
    WHERE workspace_id = '${ids.workspace}';
  `)

  await assert.rejects(
    database.query(
      'SELECT disconnect_google_business_workspace($1::uuid, $2::uuid)',
      [ids.workspace, ids.otherUser]
    ),
    /workspace_not_owned/
  )
  await database.query(
    'SELECT disconnect_google_business_workspace($1::uuid, $2::uuid)',
    [ids.workspace, ids.user]
  )

  const state = await database.query<{
    status: string
    access_token_encrypted: string | null
    active_links: number
    restaurants: number
    resource_names: number
    canonical_ids: number
    legacy_credentials: number
    other_status: string
    other_refresh: string
  }>(`
    SELECT
      (SELECT status FROM google_business_connections WHERE id = '${ids.connection}') AS status,
      (SELECT access_token_encrypted FROM google_business_connections WHERE id = '${ids.connection}') AS access_token_encrypted,
      (SELECT count(*)::int FROM google_business_locations WHERE workspace_id = '${ids.workspace}' AND is_active) AS active_links,
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}') AS restaurants,
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}' AND google_location_name IS NOT NULL) AS resource_names,
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}' AND google_business_location_id IS NOT NULL) AS canonical_ids,
      (SELECT count(*)::int FROM restaurants WHERE workspace_id = '${ids.workspace}' AND google_refresh_token IS NOT NULL) AS legacy_credentials,
      (SELECT status FROM google_business_connections WHERE id = '${ids.otherConnection}') AS other_status,
      (SELECT refresh_token_encrypted FROM google_business_connections WHERE id = '${ids.otherConnection}') AS other_refresh
  `)
  assert.deepEqual(state.rows[0], {
    status: 'disconnected',
    access_token_encrypted: null,
    active_links: 0,
    restaurants: 2,
    resource_names: 2,
    canonical_ids: 2,
    legacy_credentials: 0,
    other_status: 'active',
    other_refresh: 'other-refresh',
  })
})

test('encrypted tokens are authenticated, kind-bound, refreshable, and rotatable', async () => {
  const saved = {
    current: process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY,
    previous: process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
  const oldKey = Buffer.alloc(32, 7).toString('base64')
  const newKey = Buffer.alloc(32, 9).toString('base64')
  try {
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY = oldKey
    delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS
    const encryptedAccess = encryptGoogleBusinessToken('access-secret', 'access')
    const encryptedRefresh = encryptGoogleBusinessToken('refresh-secret', 'refresh')
    assert.equal(decryptGoogleBusinessToken(encryptedAccess, 'access').plaintext, 'access-secret')
    assert.throws(() => decryptGoogleBusinessToken(encryptedAccess, 'refresh'))
    const tamperedParts = encryptedAccess.split('.')
    tamperedParts[4] = `${tamperedParts[4][0] === 'A' ? 'B' : 'A'}${tamperedParts[4].slice(1)}`
    const tampered = tamperedParts.join('.')
    assert.throws(() => decryptGoogleBusinessToken(tampered, 'access'))

    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY = newKey
    process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS = oldKey
    const rotated = rotateGoogleBusinessTokenIfNeeded(encryptedRefresh, 'refresh')
    assert.equal(rotated.plaintext, 'refresh-secret')
    assert.equal(rotated.rotated, true)
    assert.equal(decryptGoogleBusinessToken(rotated.encrypted, 'refresh').needsRotation, false)

    process.env.GOOGLE_CLIENT_ID = 'client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
    let savedUpdate: Record<string, unknown> = {}
    const fakeAdmin = {
      from: () => ({
        update: (value: Record<string, unknown>) => {
          savedUpdate = value
          return { eq: async () => ({ error: null }) }
        },
      }),
    } as unknown as SupabaseClient
    const token = await getValidGoogleBusinessAccessToken({
      id: ids.connection,
      workspace_id: ids.workspace,
      google_subject: 'google-owner-subject',
      access_token_encrypted: encryptGoogleBusinessToken('old-access', 'access'),
      refresh_token_encrypted: rotated.encrypted,
      token_expires_at: Date.now() - 1000,
      status: 'active',
    }, fakeAdmin, {
      fetchImpl: async () => new Response(JSON.stringify({
        access_token: 'refreshed-access',
        expires_in: 3600,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    })
    assert.equal(token, 'refreshed-access')
    assert.ok(savedUpdate.access_token_encrypted)
    assert.equal(
      decryptGoogleBusinessToken(String(savedUpdate.access_token_encrypted), 'access').plaintext,
      'refreshed-access'
    )

    let failedUpdate: Record<string, unknown> = {}
    const failedAdmin = {
      from: () => ({
        update: (value: Record<string, unknown>) => {
          failedUpdate = value
          return { eq: async () => ({ error: null }) }
        },
      }),
    } as unknown as SupabaseClient
    await assert.rejects(
      getValidGoogleBusinessAccessToken({
        id: ids.connection,
        workspace_id: ids.workspace,
        google_subject: 'google-owner-subject',
        access_token_encrypted: encryptGoogleBusinessToken('expired-access', 'access'),
        refresh_token_encrypted: encryptGoogleBusinessToken('revoked-refresh', 'refresh'),
        token_expires_at: Date.now() - 1000,
        status: 'active',
      }, failedAdmin, {
        fetchImpl: async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }),
      }),
      (error: unknown) => error instanceof GoogleBusinessAuthorizationError
        && error.code === 'authorization_expired'
    )
    assert.equal(failedUpdate.status, 'reauthorization_required')
    assert.equal(failedUpdate.access_token_encrypted, null)
  } finally {
    if (saved.current === undefined) delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY
    else process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY = saved.current
    if (saved.previous === undefined) delete process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS
    else process.env.GOOGLE_BUSINESS_TOKEN_ENCRYPTION_KEY_PREVIOUS = saved.previous
    if (saved.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = saved.clientId
    if (saved.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = saved.clientSecret
  }
})

test('mocked Google discovery preserves account/location resources and maps quota and permission failures', async () => {
  const responses = new Map<string, Response>([
    ['accounts', new Response(JSON.stringify({ accounts: [
      { name: 'accounts/111', accountName: 'Primary Group', type: 'ORGANIZATION' },
      { name: 'accounts/222', accountName: 'Second Group', type: 'PERSONAL' },
    ] }), { status: 200 })],
    ['accounts/111/locations', new Response(JSON.stringify({ locations: [
      { name: 'locations/aaa', title: 'North', metadata: { placeId: 'place-north' } },
    ] }), { status: 200 })],
    ['accounts/222/locations', new Response(JSON.stringify({ locations: [
      { name: 'locations/bbb', title: 'South' },
    ] }), { status: 200 })],
  ])
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input)
    const key = url.includes('mybusinessaccountmanagement')
      ? 'accounts'
      : url.includes('accounts/111/locations')
        ? 'accounts/111/locations'
        : 'accounts/222/locations'
    return responses.get(key)!.clone()
  }
  const discovered = await listGoogleBusinessLocations('token', { fetchImpl })
  assert.equal(discovered.accounts.length, 2)
  assert.deepEqual(discovered.locations.map(location => ({
    account: location.accountResourceName,
    location: location.locationResourceName,
    reviewParent: location.reviewResourceName,
  })), [
    { account: 'accounts/111', location: 'locations/aaa', reviewParent: 'accounts/111/locations/aaa' },
    { account: 'accounts/222', location: 'locations/bbb', reviewParent: 'accounts/222/locations/bbb' },
  ])
  assert.equal(
    selectAuthorizedGoogleBusinessLocations(
      ['accounts/111/locations/aaa'],
      discovered.locations
    )[0].locationId,
    'aaa'
  )
  assert.throws(
    () => selectAuthorizedGoogleBusinessLocations(
      ['accounts/999/locations/fabricated'],
      discovered.locations
    ),
    (error: unknown) => error instanceof GoogleLocationsError
      && error.code === 'unauthorized_location'
      && error.status === 403
  )

  for (const [status, code] of [[403, 'permission_denied'], [429, 'quota_exhausted']] as const) {
    await assert.rejects(
      listGoogleBusinessLocations('token', {
        fetchImpl: async () => new Response('{}', { status }),
      }),
      (error: unknown) => error instanceof GoogleLocationsError && error.code === code
    )
  }

  const empty = await listGoogleBusinessLocations('token', {
    fetchImpl: async () => new Response(JSON.stringify({ accounts: [] }), { status: 200 }),
  })
  assert.deepEqual(empty, { accounts: [], locations: [] })
})

test('routes enforce verified ownership, CSRF/replay controls, server feature gates, and non-destructive disconnect', async () => {
  const oauthStart = await readFile(path.join(repoRoot, 'app/api/auth/google/route.ts'), 'utf8')
  const callback = await readFile(path.join(repoRoot, 'app/api/auth/google/callback/route.ts'), 'utf8')
  const locations = await readFile(path.join(repoRoot, 'app/api/auth/google/locations/route.ts'), 'utf8')
  const selection = await readFile(path.join(repoRoot, 'app/api/auth/google/set-location/route.ts'), 'utf8')
  const disconnect = await readFile(path.join(repoRoot, 'app/api/auth/google/disconnect/route.ts'), 'utf8')
  const postReply = await readFile(path.join(repoRoot, 'app/api/post-reply/route.ts'), 'utf8')
  const syncReviews = await readFile(path.join(repoRoot, 'app/api/sync-reviews/route.ts'), 'utf8')
  const syncCron = await readFile(path.join(repoRoot, 'app/api/cron/sync-all-reviews/route.ts'), 'utf8')
  const fetchReviews = await readFile(path.join(repoRoot, 'app/api/fetch-reviews/route.ts'), 'utf8')
  const queue = await readFile(path.join(repoRoot, 'lib/replyQueue.ts'), 'utf8')

  assert.match(oauthStart, /user\.email_confirmed_at/)
  assert.match(oauthStart, /getGoogleBusinessWorkspaceForUser/)
  assert.match(oauthStart, /hashGoogleOAuthState/)
  assert.match(oauthStart, /include_granted_scopes:\s*'false'/)
  assert.match(callback, /googleOAuthStatesMatch/)
  assert.match(callback, /consume_google_business_oauth_state/)
  assert.match(callback, /context\.workspace\.id !== consumed\.workspace_id/)
  assert.match(callback, /encryptGoogleBusinessToken/)
  assert.match(callback, /existing\.google_subject !== googleSubject/)
  assert.doesNotMatch(callback, /google_access_token\s*:/)
  assert.match(locations, /getValidGoogleBusinessAccessToken/)
  assert.match(selection, /isSameOriginRequest\(request\)/)
  assert.match(selection, /p_auth_user_id:\s*user\.id/)
  assert.match(selection, /p_connection_id:\s*connection\.id/)
  assert.match(selection, /p_google_subject:\s*connection\.google_subject/)
  assert.match(selection, /listGoogleBusinessLocations\(accessToken\)/)
  assert.match(selection, /selectAuthorizedGoogleBusinessLocations\(requestedResources, locations\)/)
  assert.doesNotMatch(selection, /body\.(title|placeId|accountId)/)
  assert.match(disconnect, /isSameOriginRequest\(request\)/)
  assert.match(disconnect, /disconnect_google_business_workspace/)
  assert.match(disconnect, /youtube_connections/)
  assert.doesNotMatch(disconnect, /\.delete\(/)
  assert.match(postReply, /isGoogleBusinessReviewPublishingEnabled/)
  assert.match(syncReviews, /isGoogleBusinessReviewSyncEnabled/)
  assert.match(syncCron, /isGoogleBusinessReviewSyncEnabled/)
  assert.match(fetchReviews, /isGoogleBusinessReviewSyncEnabled/)
  assert.match(queue, /if \(!isGoogleBusinessReviewPublishingEnabled\(\)\)/)
  assert.match(queue, /return \{ sent: 0, errors: \[\] \}/)
})

test('sensitive tables and RPC mutations remain server-only', async t => {
  const database = await createDatabase()
  t.after(() => database.close())
  const privileges = await database.query<{ role_name: string; state_execute: boolean; link_execute: boolean; disconnect_execute: boolean; token_select: boolean }>(`
    SELECT role_name,
      has_function_privilege(role_name, 'consume_google_business_oauth_state(text,uuid)', 'EXECUTE') AS state_execute,
      has_function_privilege(role_name, 'link_google_business_locations(uuid,uuid,uuid,text,jsonb,boolean)', 'EXECUTE') AS link_execute,
      has_function_privilege(role_name, 'disconnect_google_business_workspace(uuid,uuid)', 'EXECUTE') AS disconnect_execute,
      has_table_privilege(role_name, 'google_business_connections', 'SELECT') AS token_select
    FROM (VALUES ('anon'), ('authenticated'), ('service_role')) AS roles(role_name)
    ORDER BY role_name
  `)
  assert.deepEqual(privileges.rows, [
    { role_name: 'anon', state_execute: false, link_execute: false, disconnect_execute: false, token_select: false },
    { role_name: 'authenticated', state_execute: false, link_execute: false, disconnect_execute: false, token_select: false },
    { role_name: 'service_role', state_execute: true, link_execute: true, disconnect_execute: true, token_select: true },
  ])
})
