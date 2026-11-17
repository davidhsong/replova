import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  normalizePlaybookAIProposals,
  type RawPlaybookProposal,
} from '../../lib/playbookAICore'
import type {
  PlaybookProcedure,
  PlaybookState,
} from '../../lib/playbook'

const EXPECTED_PROJECT_REF = 'yhoblsunpmheyoqtdlvu'
const EXPECTED_PROJECT_NAME = 'replova-staging'
const FIXTURE_EMAIL_PREFIX = 'replova-playbook-it-'
const FIXTURE_EMAIL_SUFFIX = '@example.invalid'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const envPath = path.join(repoRoot, '.env.staging.local')

const externalIntegrationKeys = [
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'CAREERS_EMAIL',
  'CAREERS_ADMIN_EMAILS',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_ID_STARTER',
  'STRIPE_PRICE_ID_GROWTH',
  'STRIPE_PRICE_ID_AGENCY',
  'STRIPE_PRICE_ID_STARTER_INTRO',
  'STRIPE_PRICE_ID_GROWTH_INTRO',
  'STRIPE_PRICE_ID_AGENCY_INTRO',
  'GOOGLE_PLACES_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'YOUTUBE_AUTOMATION_SECRET',
  'YOUTUBE_TOKEN_ENCRYPTION_KEY',
  'CRON_SECRET',
  'NEXT_PUBLIC_GA_ID',
  'DEV_ALERT_EMAIL',
] as const

type Environment = Record<string, string>

type CookieHeaders = Headers & { getSetCookie?: () => string[] }

type TestActor = {
  label: 'A' | 'B'
  email: string
  password: string
  userId: string
  accountId: string
  workspaceId: string
  workspaceName: string
  client: SupabaseClient
  cookies: CookieJar
}

type AppServer = {
  child: ChildProcess
  origin: string
  logs: string[]
}

const checks: string[] = []

function pass(label: string) {
  checks.push(label)
}

async function withTimeout<T>(operation: PromiseLike<T>, label: string, timeoutMs = 30_000): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function parseEnvFile(filePath: string): Environment {
  if (!existsSync(filePath)) {
    throw new Error('Missing .env.staging.local. Create it with staging-only Supabase credentials.')
  }
  const result: Environment = {}
  for (const sourceLine of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = sourceLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) throw new Error('Invalid staging environment file format.')
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'")))
    ) value = value.slice(1, -1)
    result[key] = value
  }
  return result
}

function validateEnvironment(environment: Environment) {
  assert.equal(environment.STAGING_INTEGRATION_TESTS, '1')
  assert.equal(environment.STAGING_EXPECTED_SUPABASE_PROJECT_REF, EXPECTED_PROJECT_REF)
  assert.equal(environment.STAGING_EXPECTED_SUPABASE_PROJECT_NAME, EXPECTED_PROJECT_NAME)
  const url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.hostname, `${EXPECTED_PROJECT_REF}.supabase.co`)
  assert.match(environment.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', /^sb_publishable_/)
  assert.match(environment.SUPABASE_SERVICE_ROLE_KEY ?? '', /^sb_secret_/)
  for (const key of externalIntegrationKeys) assert.equal(environment[key] ?? '', '', `${key} must be disabled`)
  assert.equal(environment.REPLOVA_INTRO_PRICING_ENABLED, 'false')
  pass('staging environment is exact and external integrations are disabled')
}

function redact(value: string, environment: Environment) {
  return [environment.NEXT_PUBLIC_SUPABASE_ANON_KEY, environment.SUPABASE_SERVICE_ROLE_KEY]
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
}

async function findFreePort() {
  const server = createServer()
  server.unref()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const port = address.port
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

function serverEnvironment(environment: Environment, origin: string): NodeJS.ProcessEnv {
  const childEnvironment: NodeJS.ProcessEnv = { ...process.env, ...environment }
  for (const key of externalIntegrationKeys) childEnvironment[key] = ''
  childEnvironment.NEXT_PUBLIC_SUPABASE_URL = environment.NEXT_PUBLIC_SUPABASE_URL
  childEnvironment.NEXT_PUBLIC_SUPABASE_ANON_KEY = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY
  childEnvironment.SUPABASE_SERVICE_ROLE_KEY = environment.SUPABASE_SERVICE_ROLE_KEY
  childEnvironment.NEXT_PUBLIC_BASE_URL = origin
  childEnvironment.NEXT_PUBLIC_APP_URL = origin
  childEnvironment.NEXT_TELEMETRY_DISABLED = '1'
  childEnvironment.REPLOVA_INTRO_PRICING_ENABLED = 'false'
  delete childEnvironment.VERCEL
  delete childEnvironment.VERCEL_ENV
  delete childEnvironment.VERCEL_URL
  return childEnvironment
}

async function startApp(environment: Environment, port: number): Promise<AppServer> {
  const origin = `http://localhost:${port}`
  const buildId = path.join(repoRoot, '.next', 'BUILD_ID')
  if (!existsSync(buildId)) {
    throw new Error('No production build is available. Run npm run build with the staging-safe environment first.')
  }
  const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
  const child = spawn(
    process.execPath,
    [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: repoRoot,
      env: serverEnvironment(environment, origin),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  const logs: string[] = []
  const capture = (chunk: Buffer) => {
    const sanitized = redact(chunk.toString('utf8'), environment)
    logs.push(...sanitized.split(/\r?\n/).filter(Boolean))
    if (logs.length > 200) logs.splice(0, logs.length - 200)
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  child.once('exit', (code, signal) => {
    logs.push(`Next.js process exited (code=${String(code)}, signal=${String(signal)})`)
    if (code !== 0 && signal === null) {
      console.error(`[staging-playbook] Next.js exited unexpectedly: ${logs.slice(-20).join(' | ')}`)
    }
  })

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before readiness. ${logs.slice(-12).join(' | ')}`)
    }
    try {
      const response = await fetch(`${origin}/api/auth/session`, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) {
        await new Promise(resolve => setTimeout(resolve, 750))
        if (child.exitCode !== null) {
          throw new Error(`Next.js exited after readiness. ${logs.slice(-12).join(' | ')}`)
        }
        return { child, origin, logs }
      }
    } catch {
      // Server is still compiling.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  await stopApp({ child, origin, logs })
  throw new Error(`Next.js did not become ready. ${logs.slice(-12).join(' | ')}`)
}

async function stopApp(server: AppServer | null) {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return
  const exit = once(server.child, 'exit')
  server.child.kill('SIGTERM')
  await Promise.race([
    exit,
    new Promise(resolve => setTimeout(resolve, 8_000)),
  ])
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill('SIGKILL')
    await once(server.child, 'exit').catch(() => undefined)
  }
}

class CookieJar {
  private readonly values = new Map<string, string>()

  absorb(response: Response) {
    const headers = response.headers as CookieHeaders
    const rawCookies = headers.getSetCookie?.()
      ?? (headers.get('set-cookie')?.split(/,(?=\s*[^;,=\s]+=[^;,]*)/) ?? [])
    for (const rawCookie of rawCookies) {
      const pair = rawCookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      if (separator < 1) continue
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1).trim()
      if (/max-age=0/i.test(rawCookie) || !value) this.values.delete(name)
      else this.values.set(name, value)
    }
  }

  header() {
    return [...this.values.entries()].map(([name, value]) => `${name}=${value}`).join('; ')
  }
}

async function appFetch(
  server: AppServer,
  pathname: string,
  init: RequestInit = {},
  cookies?: CookieJar,
) {
  const headers = new Headers(init.headers)
  const cookie = cookies?.header()
  if (cookie) headers.set('Cookie', cookie)
  const response = await fetch(`${server.origin}${pathname}`, {
    ...init,
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  })
  cookies?.absorb(response)
  return response
}

async function responseBody(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { text: text.slice(0, 500) }
  }
}

async function expectStatus(response: Response, expected: number, label: string) {
  if (response.status !== expected) {
    const body = await responseBody(response)
    throw new Error(`${label}: expected ${expected}, received ${response.status}: ${JSON.stringify(body)}`)
  }
  return response
}

async function postJson(
  server: AppServer,
  pathname: string,
  body: unknown,
  cookies?: CookieJar,
  origin = server.origin,
) {
  return appFetch(server, pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  }, cookies)
}

async function loadState(server: AppServer, actor: TestActor, workspaceId = actor.workspaceId) {
  const response = await expectStatus(
    await appFetch(
      server,
      `/api/playbook?workspaceId=${encodeURIComponent(workspaceId)}`,
      {},
      actor.cookies,
    ),
    200,
    `load Playbook for actor ${actor.label}`,
  )
  const body = await response.json() as { state: PlaybookState }
  return body.state
}

async function mutate(
  server: AppServer,
  actor: TestActor,
  action: string,
  payload: Record<string, unknown>,
  expectedStatus = 200,
  workspaceId = actor.workspaceId,
) {
  return expectStatus(
    await postJson(server, '/api/playbook', { workspaceId, action, payload }, actor.cookies),
    expectedStatus,
    `${actor.label} ${action}`,
  )
}

async function requireNoError<T>(
  operation: PromiseLike<{ data: T; error: { message: string } | null }>,
  label: string,
) {
  const result = await operation
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}

function publicClient(environment: Environment) {
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
}

function adminClient(environment: Environment) {
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
}

async function listFixtureAuthUsers(admin: SupabaseClient) {
  const matches: Array<{ id: string; email?: string }> = []
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(`Unable to list staging fixture users: ${error.message}`)
    for (const user of data.users) {
      const email = user.email?.toLowerCase() ?? ''
      if (email.startsWith(FIXTURE_EMAIL_PREFIX) && email.endsWith(FIXTURE_EMAIL_SUFFIX)) {
        matches.push({ id: user.id, email: user.email })
      }
    }
    if (data.users.length < 100) break
  }
  return matches
}

async function cleanupFixtures(admin: SupabaseClient) {
  const accounts = await requireNoError(
    admin.from('accounts')
      .select('id, auth_user_id, owner_email')
      .like('owner_email', `${FIXTURE_EMAIL_PREFIX}%${FIXTURE_EMAIL_SUFFIX}`),
    'load fixture accounts for cleanup',
  ) as Array<{ id: string; auth_user_id: string | null; owner_email: string }>
  const accountIds = accounts.map(account => account.id)
  let workspaceIds: string[] = []
  if (accountIds.length > 0) {
    const workspaces = await requireNoError(
      admin.from('business_workspaces').select('id').in('account_id', accountIds),
      'load fixture workspaces for cleanup',
    ) as Array<{ id: string }>
    workspaceIds = workspaces.map(workspace => workspace.id)
  }
  if (workspaceIds.length > 0) {
    await requireNoError(
      admin.from('restaurants').delete().in('workspace_id', workspaceIds).select('id'),
      'delete fixture locations',
    )
    await requireNoError(
      admin.from('business_workspaces').delete().in('id', workspaceIds).select('id'),
      'delete fixture workspaces',
    )
  }
  if (accountIds.length > 0) {
    await requireNoError(
      admin.from('accounts').delete().in('id', accountIds).select('id'),
      'delete fixture accounts',
    )
  }
  const users = await listFixtureAuthUsers(admin)
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Unable to delete staging fixture user: ${error.message}`)
  }
  return { accounts: accountIds.length, workspaces: workspaceIds.length, users: users.length }
}

async function createActor(
  admin: SupabaseClient,
  environment: Environment,
  server: AppServer,
  label: 'A' | 'B',
  runId: string,
): Promise<TestActor> {
  const email = `${FIXTURE_EMAIL_PREFIX}${label.toLowerCase()}-${runId}${FIXTURE_EMAIL_SUFFIX}`
  const password = randomBytes(32).toString('base64url')
  const workspaceName = `Replova Playbook Staging IT ${label} ${runId}`
  console.log(`[staging-playbook] creating synthetic Auth user ${label}`)
  const { data: created, error: createError } = await withTimeout(admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: `Replova Staging Test ${label}`,
      synthetic_integration_fixture: true,
    },
  }), `create synthetic Auth user ${label}`)
  if (createError || !created.user) {
    throw new Error(`Unable to create synthetic staging user ${label}: ${createError?.message ?? 'no user returned'}`)
  }

  console.log(`[staging-playbook] authenticating synthetic Auth user ${label}`)
  const client = publicClient(environment)
  const { data: signIn, error: signInError } = await withTimeout(
    client.auth.signInWithPassword({ email, password }),
    `authenticate synthetic Auth user ${label}`,
  )
  if (signInError || !signIn.session) {
    throw new Error(`Unable to authenticate synthetic staging user ${label}: ${signInError?.message ?? 'no session returned'}`)
  }
  assert.equal(signIn.user.email_confirmed_at !== null, true)
  assert.equal(signIn.user.id, created.user.id)

  const cookies = new CookieJar()
  console.log(`[staging-playbook] exchanging application session ${label}`)
  const sessionResponse = await expectStatus(
    await postJson(server, '/api/auth/session', {
      accessToken: signIn.session.access_token,
      refreshToken: signIn.session.refresh_token,
    }, cookies),
    200,
    `establish app session for actor ${label}`,
  )
  assert.equal((await sessionResponse.json() as { authenticated: boolean }).authenticated, true)
  const sessionCheck = await expectStatus(
    await appFetch(server, '/api/auth/session', {}, cookies),
    200,
    `verify app session for actor ${label}`,
  )
  assert.equal((await sessionCheck.json() as { authenticated: boolean }).authenticated, true)

  console.log(`[staging-playbook] provisioning application workspace ${label}`)
  const workspaceResponse = await expectStatus(
    await postJson(server, '/api/onboarding/workspace', { name: workspaceName }, cookies),
    200,
    `provision workspace for actor ${label}`,
  )
  const workspace = await workspaceResponse.json() as {
    accountId: string
    workspaceId: string
    created: boolean
  }
  assert.ok(workspace.accountId)
  assert.ok(workspace.workspaceId)
  assert.equal(workspace.created, true)

  return {
    label,
    email,
    password,
    userId: created.user.id,
    accountId: workspace.accountId,
    workspaceId: workspace.workspaceId,
    workspaceName,
    client,
    cookies,
  }
}

function procedureSnapshot(
  procedure: PlaybookProcedure,
  changes: Partial<{
    title: string
    description: string
    objective: string
    steps: string[]
    status: 'draft' | 'active' | 'archived'
  }> = {},
) {
  return {
    title: changes.title ?? procedure.title,
    category: procedure.category,
    description: changes.description ?? procedure.description,
    objective: changes.objective ?? procedure.objective,
    steps: changes.steps ?? procedure.steps,
    responsible_role_id: procedure.responsible_role_id,
    assigned_person_id: procedure.assigned_person_id,
    status: changes.status ?? procedure.status,
  }
}

async function assertServiceKeyAbsentFromBrowser(server: AppServer, actor: TestActor, secret: string) {
  const response = await expectStatus(
    await appFetch(server, '/dashboard/playbook', {}, actor.cookies),
    200,
    'render authenticated Playbook page',
  )
  const html = await response.text()
  assert.equal(html.includes(secret), false)
  assert.match(html, /Business Playbook/)
  const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map(match => match[1])
    .filter(source => source.startsWith('/_next/'))
  assert.ok(sources.length > 0)
  for (const source of new Set(sources)) {
    const script = await appFetch(server, source, {}, actor.cookies)
    assert.equal(script.ok, true)
    assert.equal((await script.text()).includes(secret), false)
  }
}

async function run() {
  const environment = parseEnvFile(envPath)
  validateEnvironment(environment)
  console.log('[staging-playbook] target and fail-closed environment verified')
  const admin = adminClient(environment)
  const initialCleanup = await cleanupFixtures(admin)
  pass(`stale synthetic fixtures cleaned (${initialCleanup.users} users)`)
  console.log('[staging-playbook] stale synthetic fixtures cleared')

  const port = await findFreePort()
  let server: AppServer | null = null
  let testFailure: unknown = null
  const runId = `${Date.now()}-${randomBytes(3).toString('hex')}`

  try {
    server = await startApp(environment, port)
    pass('isolated Next.js staging runtime started')
    console.log('[staging-playbook] isolated application runtime ready')

    const actorA = await createActor(admin, environment, server, 'A', runId)
    const actorB = await createActor(admin, environment, server, 'B', runId)
    assert.notEqual(actorA.userId, actorB.userId)
    assert.notEqual(actorA.workspaceId, actorB.workspaceId)
    pass('two confirmed synthetic users established legitimate app sessions and separate workspaces')
    console.log('[staging-playbook] two authenticated workspaces provisioned')

    const emptyA = await loadState(server, actorA)
    const emptyB = await loadState(server, actorB)
    assert.deepEqual(
      [emptyA.roles.length, emptyA.people.length, emptyA.procedures.length, emptyA.versions.length, emptyA.proposals.length, emptyA.tasks.length],
      [0, 0, 0, 0, 0, 0],
    )
    assert.deepEqual(
      [emptyB.roles.length, emptyB.people.length, emptyB.procedures.length, emptyB.versions.length, emptyB.proposals.length, emptyB.tasks.length],
      [0, 0, 0, 0, 0, 0],
    )
    pass('application recognized both empty persistent workspaces')
    console.log('[staging-playbook] empty persistent workspaces loaded')

    await mutate(server, actorA, 'role.create', {
      name: 'Staging Service Lead',
      department: 'Service Delivery',
      responsibilities: 'Own synthetic service handoffs during the staging integration test.',
    })
    await mutate(server, actorB, 'role.create', {
      name: 'Staging Workspace B Lead',
      department: 'General Operations',
      responsibilities: 'Own the isolated workspace B test records.',
    })
    let stateA = await loadState(server, actorA)
    let stateB = await loadState(server, actorB)
    const roleA = stateA.roles.find(role => role.name === 'Staging Service Lead')
    const roleB = stateB.roles.find(role => role.name === 'Staging Workspace B Lead')
    assert.ok(roleA)
    assert.ok(roleB)

    await mutate(server, actorA, 'role.update', {
      id: roleA.id,
      responsibilities: 'Own synthetic service handoffs and documented follow-up.',
    })
    await mutate(server, actorA, 'person.create', {
      display_name: 'Taylor Staging Fixture',
      job_title: 'Synthetic Service Coordinator',
      department: 'Service Delivery',
      responsibilities: 'Execute the synthetic status-update procedure.',
      role_id: roleA.id,
    })
    stateA = await loadState(server, actorA)
    const personA = stateA.people.find(person => person.display_name === 'Taylor Staging Fixture')
    assert.ok(personA)
    await mutate(server, actorA, 'person.update', {
      id: personA.id,
      responsibilities: 'Execute and document every synthetic status update.',
    })
    pass('roles and people created, retrieved, and updated through application routes')
    console.log('[staging-playbook] roles and people persisted')

    await mutate(server, actorA, 'person.create', {
      display_name: 'Cross Workspace Rejection',
      job_title: 'Invalid Fixture',
      department: 'Service Delivery',
      role_id: roleB.id,
    }, 400)

    await mutate(server, actorA, 'procedure.create', {
      snapshot: {
        title: 'Synthetic customer status updates',
        category: 'Customer Communication',
        description: 'A synthetic procedure used only for staging persistence verification.',
        objective: 'Keep synthetic customers informed at documented milestones.',
        steps: [
          'Record the promised update time.',
          'Send a synthetic progress update at the promised time.',
          'Record the completed update in the test work log.',
        ],
        responsible_role_id: roleA.id,
        assigned_person_id: personA.id,
        status: 'draft',
      },
      change_summary: 'Create the initial synthetic staging procedure',
    })
    await mutate(server, actorB, 'procedure.create', {
      snapshot: {
        title: 'Workspace B isolation procedure',
        category: 'General Operations',
        description: 'A separate synthetic procedure for isolation checks.',
        objective: 'Prove workspace B retains only its own records.',
        steps: ['Create an isolated record.', 'Verify the record remains isolated.'],
        responsible_role_id: roleB.id,
        assigned_person_id: null,
        status: 'draft',
      },
      change_summary: 'Create workspace B isolation procedure',
    })
    stateA = await loadState(server, actorA)
    stateB = await loadState(server, actorB)
    let procedureA = stateA.procedures.find(item => item.title === 'Synthetic customer status updates')
    assert.ok(procedureA)
    const procedureId = procedureA.id
    assert.equal(procedureA.current_version, 1)
    assert.equal(stateA.versions.filter(version => version.procedure_id === procedureId).length, 1)

    await mutate(server, actorA, 'procedure.update', {
      id: procedureA.id,
      expected_lock_version: procedureA.lock_version,
      snapshot: procedureSnapshot(procedureA, {
        description: 'A revised synthetic procedure persisted in staging Supabase.',
        steps: [...procedureA.steps, 'Review missed synthetic updates during the daily handoff.'],
        status: 'active',
      }),
      change_summary: 'Activate and extend the synthetic status-update procedure',
    })
    stateA = await loadState(server, actorA)
    procedureA = stateA.procedures.find(item => item.id === procedureId)
    assert.ok(procedureA)
    assert.equal(procedureA.current_version, 2)
    assert.equal(procedureA.lock_version, 2)
    assert.deepEqual(
      stateA.versions.filter(version => version.procedure_id === procedureId)
        .map(version => version.version_number).sort((left, right) => left - right),
      [1, 2],
    )
    await mutate(server, actorA, 'procedure.update', {
      id: procedureA.id,
      expected_lock_version: 1,
      snapshot: procedureSnapshot(procedureA),
      change_summary: 'This stale update must be rejected',
    }, 409)
    pass('procedure creation, editing, optimistic locking, and version history persisted')
    console.log('[staging-playbook] procedures and version history persisted')

    const locationA = await requireNoError(
      admin.from('restaurants').insert({
        workspace_id: actorA.workspaceId,
        name: 'Synthetic Playbook Staging Location A',
        place_id: `playbook-it-a-${runId}`,
        owner_email: actorA.email,
        active: true,
      }).select('id').single(),
      'create synthetic fixture location A',
    ) as { id: string }
    const locationB = await requireNoError(
      admin.from('restaurants').insert({
        workspace_id: actorB.workspaceId,
        name: 'Synthetic Playbook Staging Location B',
        place_id: `playbook-it-b-${runId}`,
        owner_email: actorB.email,
        active: true,
      }).select('id').single(),
      'create synthetic fixture location B',
    ) as { id: string }
    const now = Date.now()
    const reviewsA = await requireNoError(
      admin.from('reviews').insert([
        {
          restaurant_id: locationA.id,
          author: 'Synthetic Reviewer A1',
          rating: 2,
          review_text: 'Synthetic feedback: the promised status update arrived late.',
          review_timestamp: now - 86_400_000,
          google_review_name: `playbook-it-${runId}-a1`,
        },
        {
          restaurant_id: locationA.id,
          author: 'Synthetic Reviewer A2',
          rating: 3,
          review_text: 'Synthetic feedback: a clearer progress update would have helped.',
          review_timestamp: now - 172_800_000,
          google_review_name: `playbook-it-${runId}-a2`,
        },
        {
          restaurant_id: locationA.id,
          author: 'Synthetic Reviewer A3',
          rating: 2,
          review_text: 'Synthetic feedback: no update was recorded at the promised time.',
          review_timestamp: now - 259_200_000,
          google_review_name: `playbook-it-${runId}-a3`,
        },
      ]).select('id, rating, review_text, review_timestamp'),
      'create synthetic feedback evidence A',
    ) as Array<{ id: string; rating: number; review_text: string; review_timestamp: number }>
    const reviewB = await requireNoError(
      admin.from('reviews').insert({
        restaurant_id: locationB.id,
        author: 'Synthetic Reviewer B1',
        rating: 4,
        review_text: 'Synthetic workspace B evidence must remain isolated.',
        review_timestamp: now - 86_400_000,
        google_review_name: `playbook-it-${runId}-b1`,
      }).select('id').single(),
      'create synthetic feedback evidence B',
    ) as { id: string }

    const rawProposal: RawPlaybookProposal = {
      proposalKind: 'change_procedure',
      procedureId: procedureA.id,
      problem: 'Synthetic staging feedback repeatedly describes missed or unclear status updates.',
      proposedSnapshot: {
        title: procedureA.title,
        category: procedureA.category,
        description: 'Document each promised customer update and its completion.',
        objective: procedureA.objective,
        steps: [
          ...procedureA.steps,
          'Escalate a missed update during the same synthetic staging shift.',
        ],
        responsibleRoleId: roleA.id,
        assignedPersonId: personA.id,
        status: 'draft',
      },
      expectedBenefit: 'Hypothesis: explicit ownership may reduce missed synthetic status updates.',
      priority: 'high',
      rationale: 'Three synthetic feedback records describe the same recurring handoff gap.',
      suggestedRoleId: roleA.id,
      evidenceIds: reviewsA.map(review => review.id),
    }
    const normalized = normalizePlaybookAIProposals(
      [rawProposal],
      reviewsA.map(review => ({
        id: review.id,
        rating: review.rating,
        text: review.review_text,
        receivedAt: new Date(Number(review.review_timestamp)).toISOString(),
      })),
      stateA.procedures,
      stateA.roles,
      stateA.people,
      false,
    )
    const unauthorizedEvidenceAttempt = [{
      ...normalized[0],
      evidence_ids: [reviewsA[0].id, reviewB.id],
    }]
    const unauthorizedEvidence = await admin.rpc('playbook_create_ai_proposals', {
      p_workspace_id: actorA.workspaceId,
      p_actor_id: actorA.userId,
      p_model: 'staging-deterministic-ai-fixture',
      p_proposals: unauthorizedEvidenceAttempt,
    })
    assert.ok(unauthorizedEvidence.error)
    assert.match(unauthorizedEvidence.error.message, /unauthorized_evidence/)

    await requireNoError(
      admin.rpc('playbook_create_ai_proposals', {
        p_workspace_id: actorA.workspaceId,
        p_actor_id: actorA.userId,
        p_model: 'staging-deterministic-ai-fixture',
        p_proposals: normalized,
      }),
      'persist deterministic proposal through hardened Playbook RPC',
    )
    stateA = await loadState(server, actorA)
    let proposalA = stateA.proposals.find(proposal => proposal.model === 'staging-deterministic-ai-fixture')
    assert.ok(proposalA)
    assert.equal(proposalA.status, 'pending')
    assert.equal(proposalA.evidence.length, 3)
    assert.equal(proposalA.evidence.every(evidence => evidence.restaurant_id === locationA.id), true)
    pass('deterministic AI fixture used real proposal and evidence persistence without an OpenAI call')

    await mutate(server, actorA, 'proposal.apply', {
      id: proposalA.id,
      expected_lock_version: proposalA.lock_version,
      expected_procedure_lock_version: procedureA.lock_version,
      change_summary: 'Pending proposal must not apply',
    }, 409)
    await mutate(server, actorA, 'proposal.review', {
      id: proposalA.id,
      expected_lock_version: proposalA.lock_version,
      review_action: 'edit',
      edits: {
        problem: proposalA.problem,
        expected_benefit: proposalA.expected_benefit,
        rationale: 'Owner-edited synthetic rationale before approval.',
        priority: proposalA.priority,
        proposed_snapshot: proposalA.proposed_snapshot,
        suggested_role_id: proposalA.suggested_role_id,
      },
    })
    stateA = await loadState(server, actorA)
    proposalA = stateA.proposals.find(proposal => proposal.id === proposalA?.id)
    assert.ok(proposalA)
    assert.equal(proposalA.lock_version, 2)
    await mutate(server, actorA, 'proposal.review', {
      id: proposalA.id,
      expected_lock_version: proposalA.lock_version,
      review_action: 'approve',
    })
    stateA = await loadState(server, actorA)
    proposalA = stateA.proposals.find(proposal => proposal.id === proposalA?.id)
    procedureA = stateA.procedures.find(procedure => procedure.id === procedureA?.id)
    assert.ok(proposalA)
    assert.ok(procedureA)
    assert.equal(proposalA.status, 'approved')
    assert.ok(proposalA.approved_at)
    await mutate(server, actorA, 'proposal.review', {
      id: proposalA.id,
      expected_lock_version: 2,
      review_action: 'approve',
    }, 409)
    await mutate(server, actorA, 'proposal.apply', {
      id: proposalA.id,
      expected_lock_version: proposalA.lock_version,
      expected_procedure_lock_version: procedureA.lock_version,
      change_summary: 'Apply the owner-approved synthetic staging recommendation',
    })
    stateA = await loadState(server, actorA)
    proposalA = stateA.proposals.find(proposal => proposal.id === proposalA?.id)
    procedureA = stateA.procedures.find(procedure => procedure.id === procedureA?.id)
    assert.ok(proposalA)
    assert.ok(procedureA)
    assert.equal(proposalA.status, 'applied')
    assert.equal(procedureA.current_version, 3)
    const procedureVersions = stateA.versions
      .filter(version => version.procedure_id === procedureA?.id)
      .sort((left, right) => left.version_number - right.version_number)
    assert.deepEqual(procedureVersions.map(version => version.version_number), [1, 2, 3])
    assert.deepEqual(procedureVersions.map(version => version.source), ['manual', 'manual', 'ai_proposal'])
    assert.equal(procedureVersions[2].source_proposal_id, proposalA.id)
    pass('proposal edit, approval, application, audit links, and invalid transitions verified')
    console.log('[staging-playbook] persistent Playbook workflow verified')

    await mutate(server, actorA, 'task.create', {
      title: 'Train on the synthetic status-update procedure',
      description: 'Review the applied staging-only procedure and record completion.',
      procedure_id: procedureA.id,
      proposal_id: proposalA.id,
      role_id: roleA.id,
      person_id: personA.id,
      priority: 'high',
      status: 'todo',
      due_date: '2099-01-15',
    })
    stateA = await loadState(server, actorA)
    const taskA = stateA.tasks.find(task => task.title === 'Train on the synthetic status-update procedure')
    assert.ok(taskA)
    await mutate(server, actorA, 'task.update', { id: taskA.id, status: 'in_progress' })
    await mutate(server, actorA, 'task.update', { id: taskA.id, status: 'done' })
    stateA = await loadState(server, actorA)
    const completedTask = stateA.tasks.find(task => task.id === taskA.id)
    assert.equal(completedTask?.status, 'done')
    assert.ok(completedTask?.completed_at)
    pass('linked task creation and status updates persisted')

    await expectStatus(
      await appFetch(server, `/api/playbook?workspaceId=${actorB.workspaceId}`, {}, actorA.cookies),
      403,
      'actor A route read of workspace B',
    )
    await expectStatus(
      await postJson(server, '/api/playbook', {
        workspaceId: actorB.workspaceId,
        action: 'role.create',
        payload: { name: 'Unauthorized Cross Workspace Role', department: 'Invalid' },
      }, actorA.cookies),
      403,
      'actor A route mutation of workspace B',
    )
    await expectStatus(
      await appFetch(server, `/api/playbook?workspaceId=${actorA.workspaceId}`),
      401,
      'anonymous Playbook route read',
    )
    await expectStatus(
      await postJson(server, '/api/playbook', {
        workspaceId: actorA.workspaceId,
        action: 'role.create',
        payload: { name: 'Anonymous Role', department: 'Invalid' },
      }),
      401,
      'anonymous Playbook route mutation',
    )
    await expectStatus(
      await postJson(server, '/api/playbook', {
        workspaceId: actorA.workspaceId,
        action: 'role.create',
        payload: { name: 'Cross Origin Role', department: 'Invalid' },
      }, actorA.cookies, 'https://attacker.invalid'),
      403,
      'cross-origin Playbook mutation',
    )

    const ownRolesA = await actorA.client.from('playbook_roles').select('id, workspace_id')
    assert.equal(ownRolesA.error, null)
    assert.equal((ownRolesA.data ?? []).every(row => row.workspace_id === actorA.workspaceId), true)
    const crossRolesA = await actorA.client.from('playbook_roles')
      .select('id, workspace_id').eq('workspace_id', actorB.workspaceId)
    assert.equal(crossRolesA.error, null)
    assert.equal(crossRolesA.data?.length, 0)
    const ownRolesB = await actorB.client.from('playbook_roles').select('id, workspace_id')
    assert.equal(ownRolesB.error, null)
    assert.equal((ownRolesB.data ?? []).every(row => row.workspace_id === actorB.workspaceId), true)
    const forbiddenInsert = await actorA.client.from('playbook_roles').insert({
      workspace_id: actorA.workspaceId,
      name: 'Direct Browser Insert Must Fail',
      department: 'Invalid',
    })
    assert.ok(forbiddenInsert.error)
    const forbiddenRpc = await actorA.client.rpc('playbook_create_procedure', {
      p_workspace_id: actorA.workspaceId,
      p_actor_id: actorA.userId,
      p_snapshot: procedureSnapshot(procedureA),
      p_change_summary: 'Authenticated RPC must fail',
    })
    assert.ok(forbiddenRpc.error)
    const anonymous = publicClient(environment)
    const anonymousSelect = await anonymous.from('playbook_roles').select('id')
    assert.ok(anonymousSelect.error)
    const anonymousRpc = await anonymous.rpc('playbook_create_procedure', {
      p_workspace_id: actorA.workspaceId,
      p_actor_id: actorA.userId,
      p_snapshot: procedureSnapshot(procedureA),
      p_change_summary: 'Anonymous RPC must fail',
    })
    assert.ok(anonymousRpc.error)
    const serviceFunction = await admin.rpc('playbook_snapshot_is_valid', {
      p_snapshot: procedureSnapshot(procedureA),
    })
    assert.equal(serviceFunction.error, null)
    assert.equal(serviceFunction.data, true)
    pass('route authorization, RLS isolation, client write denial, and hardened RPC permissions verified')

    await assertServiceKeyAbsentFromBrowser(server, actorA, environment.SUPABASE_SERVICE_ROLE_KEY)
    pass('service-role credential absent from rendered HTML and browser JavaScript')
    console.log('[staging-playbook] route, RLS, RPC, and browser-secret checks verified')

    const persistedIds = {
      procedure: procedureA.id,
      proposal: proposalA.id,
      task: taskA.id,
      versions: procedureVersions.map(version => version.id).sort(),
    }
    await stopApp(server)
    server = await startApp(environment, port)
    const afterRestart = await loadState(server, actorA)
    assert.ok(afterRestart.procedures.some(procedure => procedure.id === persistedIds.procedure))
    assert.ok(afterRestart.proposals.some(proposal => proposal.id === persistedIds.proposal && proposal.status === 'applied'))
    assert.ok(afterRestart.tasks.some(task => task.id === persistedIds.task && task.status === 'done'))
    assert.deepEqual(
      afterRestart.versions
        .filter(version => version.procedure_id === persistedIds.procedure)
        .map(version => version.id).sort(),
      persistedIds.versions,
    )
    const storedProcedure = await requireNoError(
      admin.from('playbook_procedures')
        .select('id, workspace_id, current_version')
        .eq('id', persistedIds.procedure)
        .eq('workspace_id', actorA.workspaceId)
        .single(),
      'verify direct persisted procedure',
    ) as { id: string; workspace_id: string; current_version: number }
    assert.equal(storedProcedure.current_version, 3)
    pass('application restart and direct database read confirmed durable Supabase persistence')
    console.log('[staging-playbook] restart persistence verified')
  } catch (error) {
    testFailure = error
    console.error(`[staging-playbook] assertion failed: ${error instanceof Error ? error.message : String(error)}`)
    if (server?.logs.length) {
      console.error(`[staging-playbook] server log tail: ${server.logs.slice(-30).join(' | ')}`)
    }
  } finally {
    await stopApp(server)
    try {
      const cleanup = await cleanupFixtures(admin)
      const remainingUsers = await listFixtureAuthUsers(admin)
      const remainingAccounts = await admin.from('accounts')
        .select('id', { count: 'exact', head: true })
        .like('owner_email', `${FIXTURE_EMAIL_PREFIX}%${FIXTURE_EMAIL_SUFFIX}`)
      if (remainingAccounts.error) {
        throw new Error(`Unable to verify fixture account cleanup: ${remainingAccounts.error.message}`)
      }
      assert.equal(remainingUsers.length, 0)
      assert.equal(remainingAccounts.count, 0)
      pass(`synthetic cleanup completed (${cleanup.users} users, ${cleanup.workspaces} workspaces)`)
      console.log('[staging-playbook] synthetic fixtures removed')
    } catch (cleanupError) {
      if (testFailure) {
        throw new AggregateError([testFailure, cleanupError], 'Integration test and cleanup both failed')
      }
      throw cleanupError
    }
  }

  if (testFailure) throw testFailure
  console.log(JSON.stringify({
    target: { project: EXPECTED_PROJECT_NAME, ref: EXPECTED_PROJECT_REF },
    databasePersistence: 'real Supabase staging',
    aiGeneration: 'deterministic fixture; no OpenAI request',
    externalIntegrations: 'disabled',
    fixtureRetention: 'none',
    checks,
  }, null, 2))
}

async function main() {
  try {
    await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Staging Playbook integration failed: ${message}`)
    process.exitCode = 1
  }
}

const keepAlive = setInterval(() => undefined, 1_000)
void main().finally(() => clearInterval(keepAlive))
