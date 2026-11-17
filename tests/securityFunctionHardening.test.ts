import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test, { after, before } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationDirectory = path.join(repoRoot, 'supabase', 'migrations')

const hardenedFunctions = [
  'public.checkpoint_youtube_automation_sync(uuid,uuid,uuid,text,timestamptz,boolean)',
  'public.claim_youtube_automation_connections(integer,text,integer,uuid)',
  'public.claim_youtube_draft_items(integer,text,integer,uuid,boolean)',
  'public.claim_youtube_manual_publish(uuid,uuid,timestamptz,uuid,text)',
  'public.claim_youtube_publish_items(integer,text,integer)',
  'public.consume_google_business_oauth_state(text,uuid)',
  'public.current_user_owns_replova_account(uuid)',
  'public.current_user_owns_replova_workspace(uuid)',
  'public.delete_youtube_knowledge_base_on_disconnect()',
  'public.disconnect_google_business_workspace(uuid,uuid)',
  'public.fail_youtube_manual_publish(uuid,uuid,uuid,uuid,text,boolean,text,text)',
  'public.fail_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text)',
  'public.finish_youtube_automation_connection(uuid,uuid,uuid,boolean,text)',
  'public.finish_youtube_manual_publish(uuid,uuid,uuid,uuid,text,text,text,timestamptz,boolean)',
  'public.finish_youtube_reply_regeneration(uuid,uuid,uuid,uuid,text,text,numeric,boolean)',
  'public.finish_youtube_reply_regeneration_with_context(uuid,uuid,uuid,uuid,text,text,numeric,boolean,boolean,text,uuid[])',
  'public.grant_youtube_auto_publish_consent(uuid,uuid,text)',
  'public.invalidate_youtube_auto_publish_consent_on_scope_change()',
  'public.link_google_business_locations(uuid,uuid,uuid,text,jsonb,boolean)',
  'public.owns_youtube_connection(uuid)',
  'public.preview_phase6a_workspace_backfill()',
  'public.provision_replova_account_workspace(uuid,text,text,text)',
  'public.replace_youtube_playlist_memberships(uuid,text,jsonb,boolean,timestamptz)',
  'public.revoke_youtube_auto_publish_consent(uuid,uuid)',
  'public.run_phase6a_workspace_backfill(text)',
  'public.set_youtube_automation_emergency_pause(uuid,uuid,boolean)',
  'public.transition_youtube_reply_queue_item(uuid,uuid,timestamptz,text,text,uuid)',
  'public.update_youtube_auto_publish_policy(uuid,uuid,timestamptz,jsonb,integer,numeric,integer,integer,text,text[])',
  'public.validate_replova_account_auth_user()',
  'public.validate_replova_knowledge_base_owner()',
  'public.validate_replova_knowledge_entry_owner()',
  'public.validate_replova_restaurant_workspace_owner()',
  'public.validate_youtube_auto_publish_consent()',
] as const

const authenticatedRlsFunctions = new Set([
  'public.current_user_owns_replova_account(uuid)',
  'public.current_user_owns_replova_workspace(uuid)',
  'public.owns_youtube_connection(uuid)',
])

const disabledFunctions = new Set([
  'public.claim_youtube_publish_items(integer,text,integer)',
])

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
  const sql = await readFile(path.join(migrationDirectory, name), 'utf8')
  await database.exec(pgliteCompatibleSql(sql))
}

async function createDatabase(through = 32): Promise<PGlite> {
  const database = new PGlite()
  await database.exec(prelude)
  for (const name of await migrationFiles(through)) await applyMigration(database, name)
  return database
}

async function expectPermissionDenied(
  database: PGlite,
  role: 'anon' | 'authenticated',
  sql: string,
): Promise<void> {
  await database.exec('BEGIN')
  try {
    await database.exec(`SET LOCAL ROLE ${role}`)
    await assert.rejects(database.query(sql), /permission denied for function/i)
  } finally {
    await database.exec('ROLLBACK')
  }
}

let database: PGlite

before(async () => {
  database = await createDatabase()
})

after(async () => {
  await database.close()
})

test('migration 032 requires 031 and is safely repeatable after it', async t => {
  const dependencyDatabase = await createDatabase(30)
  t.after(() => dependencyDatabase.close())

  const migration032 = '032_security_function_hardening.sql'
  await assert.rejects(
    applyMigration(dependencyDatabase, migration032),
    /migration_032_requires_migration_031/i,
  )
  await applyMigration(dependencyDatabase, '031_business_playbook.sql')
  await applyMigration(dependencyDatabase, migration032)
  await applyMigration(dependencyDatabase, migration032)
})

test('all 33 audited functions retain postgres ownership and hardened paths', async () => {
  const rows = await database.query<{
    signature: string
    owner_name: string
    security_definer: boolean
    configuration: string[]
  }>(`
    SELECT
      namespace.nspname || '.' || procedure.proname || '('
        || pg_get_function_identity_arguments(procedure.oid) || ')' AS signature,
      pg_get_userbyid(procedure.proowner) AS owner_name,
      procedure.prosecdef AS security_definer,
      coalesce(procedure.proconfig, ARRAY[]::text[]) AS configuration
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
    WHERE procedure.oid = ANY($1::regprocedure[])
    ORDER BY signature
  `, [hardenedFunctions])

  assert.equal(rows.rows.length, 33)
  for (const row of rows.rows) {
    assert.equal(row.owner_name, 'postgres', row.signature)
    assert.equal(row.security_definer, true, row.signature)
    const searchPath = row.configuration.find(item => item.startsWith('search_path='))
    assert.match(searchPath ?? '', /^search_path=pg_catalog, public,(?: auth,)? pg_temp$/)
  }
})

test('function ACLs deny anon, preserve only RLS auth calls, and keep publishing disabled', async () => {
  for (const signature of hardenedFunctions) {
    const result = await database.query<{
      anon_execute: boolean
      authenticated_execute: boolean
      service_execute: boolean
    }>(`
      SELECT
        has_function_privilege('anon', $1, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', $1, 'EXECUTE') AS authenticated_execute,
        has_function_privilege('service_role', $1, 'EXECUTE') AS service_execute
    `, [signature])
    const privileges = result.rows[0]
    assert.equal(privileges.anon_execute, false, signature)
    assert.equal(
      privileges.authenticated_execute,
      authenticatedRlsFunctions.has(signature),
      signature,
    )
    assert.equal(privileges.service_execute, !disabledFunctions.has(signature), signature)
  }
})

test('database roles enforce RPC denial and allow intended server workers', async () => {
  await expectPermissionDenied(
    database,
    'anon',
    "SELECT * FROM public.claim_youtube_automation_connections(1, 'anon', 60, gen_random_uuid())",
  )
  await expectPermissionDenied(
    database,
    'authenticated',
    "SELECT * FROM public.claim_youtube_draft_items(1, 'authenticated', 15, NULL, true)",
  )
  await database.exec('BEGIN')
  try {
    await database.exec('SET LOCAL ROLE service_role')
    const claimed = await database.query(
      "SELECT * FROM public.claim_youtube_automation_connections(1, 'worker-test', 60, gen_random_uuid())",
    )
    assert.equal(claimed.rows.length, 0)
  } finally {
    await database.exec('ROLLBACK')
  }
})

test('RLS ownership predicates retain owner access and deny cross-workspace reads', async () => {
  await database.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('10000000-0000-0000-0000-000000000001', 'owner-one@example.test'),
      ('10000000-0000-0000-0000-000000000002', 'owner-two@example.test');
    INSERT INTO public.accounts (id, owner_email, auth_user_id) VALUES
      ('20000000-0000-0000-0000-000000000001', 'owner-one@example.test', '10000000-0000-0000-0000-000000000001'),
      ('20000000-0000-0000-0000-000000000002', 'owner-two@example.test', '10000000-0000-0000-0000-000000000002');
    INSERT INTO public.business_workspaces (id, account_id, name) VALUES
      ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Owner one workspace'),
      ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Owner two workspace');
  `)

  await database.exec('BEGIN')
  try {
    await database.exec(`
      SET LOCAL ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
      SELECT set_config('request.jwt.claim.email', 'owner-one@example.test', true);
    `)
    const ownership = await database.query<{
      owns_self: boolean
      owns_other: boolean
      visible_workspaces: number
    }>(`
      SELECT
        public.current_user_owns_replova_workspace('30000000-0000-0000-0000-000000000001') AS owns_self,
        public.current_user_owns_replova_workspace('30000000-0000-0000-0000-000000000002') AS owns_other,
        (SELECT count(*)::integer FROM public.business_workspaces) AS visible_workspaces
    `)
    assert.deepEqual(ownership.rows[0], {
      owns_self: true,
      owns_other: false,
      visible_workspaces: 1,
    })
  } finally {
    await database.exec('ROLLBACK')
  }
})

test('Google state consumption and YouTube trigger-backed service operations still work', async () => {
  const stateHash = 'a'.repeat(64)
  await database.exec(`
    INSERT INTO public.google_business_oauth_states (
      state_hash, workspace_id, auth_user_id, expires_at
    ) VALUES (
      '${stateHash}',
      '30000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      now() + interval '10 minutes'
    );
    INSERT INTO public.youtube_connections (
      id, user_id, channel_id, access_token_encrypted,
      refresh_token_encrypted, token_expires_at
    ) VALUES (
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'channel-security-test', 'encrypted-access', 'encrypted-refresh', 9999999999999
    );
  `)

  await database.exec('BEGIN')
  try {
    await database.exec('SET LOCAL ROLE service_role')
    const consumed = await database.query<{ workspace_id: string }>(`
      SELECT * FROM public.consume_google_business_oauth_state(
        '${stateHash}', '10000000-0000-0000-0000-000000000001'
      )
    `)
    assert.equal(consumed.rows[0].workspace_id, '30000000-0000-0000-0000-000000000001')

    const paused = await database.query<{ emergency_paused: boolean }>(`
      SELECT emergency_paused
      FROM public.set_youtube_automation_emergency_pause(
        '40000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        true
      )
    `)
    assert.equal(paused.rows[0].emergency_paused, true)
  } finally {
    await database.exec('COMMIT')
  }

  const persisted = await database.query<{
    consumed: boolean
    emergency_paused: boolean
    log_count: number
  }>(`
    SELECT
      (SELECT consumed_at IS NOT NULL FROM public.google_business_oauth_states WHERE state_hash = '${stateHash}') AS consumed,
      (SELECT emergency_paused FROM public.youtube_automation_settings WHERE connection_id = '40000000-0000-0000-0000-000000000001') AS emergency_paused,
      (SELECT count(*)::integer FROM public.youtube_automation_logs WHERE connection_id = '40000000-0000-0000-0000-000000000001') AS log_count
  `)
  assert.deepEqual(persisted.rows[0], {
    consumed: true,
    emergency_paused: true,
    log_count: 1,
  })
})
