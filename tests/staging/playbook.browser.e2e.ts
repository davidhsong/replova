import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  chromium,
  type APIResponse,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
  type Response,
} from 'playwright-core'
import {
  normalizePlaybookAIProposals,
  type RawPlaybookProposal,
} from '../../lib/playbookAICore'
import type { PlaybookProcedure, PlaybookState } from '../../lib/playbook'

const EXPECTED_PROJECT_REF = 'yhoblsunpmheyoqtdlvu'
const EXPECTED_PROJECT_NAME = 'replova-staging'
const PRODUCTION_PROJECT_REF = 'rxapxrlkfjpauounengo'
const FIXTURE_EMAIL_PREFIX = 'replova-playbook-browser-it-'
const FIXTURE_EMAIL_SUFFIX = '@example.invalid'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const envPath = path.join(repoRoot, '.env.staging.local')
const artifactRoot = path.join(repoRoot, 'tmp', 'staging-playbook-browser')

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

type AppServer = {
  child: ChildProcess
  origin: string
  logs: string[]
}

type TestActor = {
  label: 'A' | 'B'
  email: string
  password: string
  userId: string
  accountId: string
  workspaceId: string
  workspaceName: string
  restaurantId: string
  client: SupabaseClient
  context: BrowserContext
}

type BrowserApiResult<T = unknown> = {
  status: number
  body: T
}

const checks: string[] = []

function pass(label: string) {
  checks.push(label)
  console.log(`[staging-playbook-browser] PASS: ${label}`)
}

async function withTimeout<T>(
  operation: PromiseLike<T>,
  label: string,
  timeoutMs = 30_000,
): Promise<T> {
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
  for (const [key, value] of Object.entries(environment)) {
    assert.equal(
      value.toLowerCase().includes(PRODUCTION_PROJECT_REF),
      false,
      `${key} references the Production project`,
    )
  }
  for (const [key, value] of Object.entries(process.env)) {
    assert.equal(
      String(value ?? '').toLowerCase().includes(PRODUCTION_PROJECT_REF),
      false,
      `inherited ${key} references the Production project`,
    )
  }
  for (const key of externalIntegrationKeys) {
    assert.equal(environment[key] ?? '', '', `${key} must be disabled`)
  }
  assert.equal(environment.REPLOVA_INTRO_PRICING_ENABLED, 'false')
  pass('environment targets only replova-staging and all external side effects are disabled')
}

function redact(value: string, environment: Environment) {
  return [
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    environment.SUPABASE_SERVICE_ROLE_KEY,
  ]
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
}

function isolatedProcessEnvironment(
  environment: Environment,
  origin: string,
): NodeJS.ProcessEnv {
  const childEnvironment: NodeJS.ProcessEnv = { ...process.env }
  for (const key of Object.keys(childEnvironment)) {
    if (
      /^(?:DATABASE_URL|DIRECT_URL|POSTGRES.*|PGHOST|PGPORT|PGDATABASE|PGUSER|PGPASSWORD|SUPABASE.*)$/i.test(key)
    ) delete childEnvironment[key]
  }
  Object.assign(childEnvironment, environment)
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
  for (const [key, value] of Object.entries(childEnvironment)) {
    assert.equal(
      String(value ?? '').toLowerCase().includes(PRODUCTION_PROJECT_REF),
      false,
      `isolated child ${key} references the Production project`,
    )
  }
  return childEnvironment
}

function nextBinary() {
  return path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next')
}

async function buildApp(environment: Environment) {
  console.log('[staging-playbook-browser] building the production app with explicit staging-only environment')
  const output: string[] = []
  const child = spawn(process.execPath, [nextBinary(), 'build'], {
    cwd: repoRoot,
    env: isolatedProcessEnvironment(environment, 'http://localhost:3000'),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const capture = (chunk: Buffer) => {
    const sanitized = redact(chunk.toString('utf8'), environment)
    output.push(...sanitized.split(/\r?\n/).filter(Boolean))
    if (output.length > 250) output.splice(0, output.length - 250)
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)
  const [code] = await once(child, 'exit') as [number | null]
  if (code !== 0) {
    throw new Error(`Staging-safe production build failed. ${output.slice(-30).join(' | ')}`)
  }
  assert.equal(existsSync(path.join(repoRoot, '.next', 'BUILD_ID')), true)
  pass('production build completed with explicit staging-only environment')
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
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })
  return port
}

async function startApp(environment: Environment, port: number): Promise<AppServer> {
  const origin = `http://localhost:${port}`
  const child = spawn(
    process.execPath,
    [nextBinary(), 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: repoRoot,
      env: isolatedProcessEnvironment(environment, origin),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  )
  const logs: string[] = []
  const capture = (chunk: Buffer) => {
    const sanitized = redact(chunk.toString('utf8'), environment)
    logs.push(...sanitized.split(/\r?\n/).filter(Boolean))
    if (logs.length > 250) logs.splice(0, logs.length - 250)
  }
  child.stdout?.on('data', capture)
  child.stderr?.on('data', capture)

  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js exited before readiness. ${logs.slice(-20).join(' | ')}`)
    }
    try {
      const response = await fetch(`${origin}/api/auth/session`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (response.ok) return { child, origin, logs }
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  await stopApp({ child, origin, logs })
  throw new Error(`Next.js did not become ready. ${logs.slice(-20).join(' | ')}`)
}

async function stopApp(server: AppServer | null) {
  if (!server || server.child.exitCode !== null || server.child.signalCode !== null) return
  const exit = once(server.child, 'exit')
  server.child.kill('SIGTERM')
  await Promise.race([exit, new Promise(resolve => setTimeout(resolve, 8_000))])
  if (server.child.exitCode === null && server.child.signalCode === null) {
    server.child.kill('SIGKILL')
    await once(server.child, 'exit').catch(() => undefined)
  }
}

function adminClient(environment: Environment) {
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function publicClient(environment: Environment) {
  return createClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function requireNoError<T>(
  operation: PromiseLike<{ data: T; error: { message: string } | null }>,
  label: string,
): Promise<T> {
  const result = await withTimeout(operation, label)
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
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
    'load browser fixture accounts for cleanup',
  ) as Array<{ id: string; auth_user_id: string | null; owner_email: string }>
  const accountIds = accounts.map(account => account.id)
  let workspaceIds: string[] = []
  if (accountIds.length > 0) {
    const workspaces = await requireNoError(
      admin.from('business_workspaces').select('id').in('account_id', accountIds),
      'load browser fixture workspaces for cleanup',
    ) as Array<{ id: string }>
    workspaceIds = workspaces.map(workspace => workspace.id)
  }
  if (workspaceIds.length > 0) {
    await requireNoError(
      admin.from('restaurants').delete().in('workspace_id', workspaceIds).select('id'),
      'delete browser fixture locations',
    )
    await requireNoError(
      admin.from('business_workspaces').delete().in('id', workspaceIds).select('id'),
      'delete browser fixture workspaces',
    )
  }
  if (accountIds.length > 0) {
    await requireNoError(
      admin.from('accounts').delete().in('id', accountIds).select('id'),
      'delete browser fixture accounts',
    )
  }
  const users = await listFixtureAuthUsers(admin)
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw new Error(`Unable to delete staging browser fixture user: ${error.message}`)
  }
  return { accounts: accountIds.length, workspaces: workspaceIds.length, users: users.length }
}

function findChromeExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
  const executable = candidates.find(candidate => existsSync(candidate))
  if (!executable) throw new Error('Chrome or Edge is required for the staging browser test.')
  return executable
}

async function exchangeApplicationSession(
  actor: Pick<TestActor, 'email' | 'password' | 'client' | 'context' | 'label'>,
  origin: string,
) {
  const { data, error } = await actor.client.auth.signInWithPassword({
    email: actor.email,
    password: actor.password,
  })
  if (error || !data.session) {
    throw new Error(`Unable to authenticate synthetic staging user ${actor.label}: ${error?.message ?? 'no session'}`)
  }
  const response = await actor.context.request.post(`${origin}/api/auth/session`, {
    headers: { Origin: origin },
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  })
  assert.equal(response.status(), 200, `establish app session for actor ${actor.label}`)
  const sessionCheck = await actor.context.request.get(`${origin}/api/auth/session`)
  assert.equal(sessionCheck.status(), 200)
  assert.equal((await sessionCheck.json() as { authenticated: boolean }).authenticated, true)
}

async function createActor(
  admin: SupabaseClient,
  environment: Environment,
  browser: Browser,
  server: AppServer,
  label: 'A' | 'B',
  runId: string,
): Promise<TestActor> {
  const email = `${FIXTURE_EMAIL_PREFIX}${label.toLowerCase()}-${runId}${FIXTURE_EMAIL_SUFFIX}`
  const password = randomBytes(32).toString('base64url')
  const workspaceName = `Replova Browser Staging ${label} ${runId}`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: `Replova Browser Test ${label}`,
      synthetic_integration_fixture: true,
    },
  })
  if (createError || !created.user) {
    throw new Error(`Unable to create synthetic staging user ${label}: ${createError?.message ?? 'no user'}`)
  }

  const context = await browser.newContext({
    baseURL: server.origin,
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const actor: TestActor = {
    label,
    email,
    password,
    userId: created.user.id,
    accountId: '',
    workspaceId: '',
    workspaceName,
    restaurantId: '',
    client: publicClient(environment),
    context,
  }
  await exchangeApplicationSession(actor, server.origin)

  const workspaceResponse = await context.request.post(`${server.origin}/api/onboarding/workspace`, {
    headers: { Origin: server.origin },
    data: { name: workspaceName },
  })
  assert.equal(workspaceResponse.status(), 200)
  const workspace = await workspaceResponse.json() as {
    accountId: string
    workspaceId: string
    created: boolean
  }
  assert.equal(workspace.created, true)
  actor.accountId = workspace.accountId
  actor.workspaceId = workspace.workspaceId

  await requireNoError(
    admin.from('accounts')
      .update({ terms_accepted_at: new Date().toISOString() })
      .eq('id', actor.accountId)
      .eq('auth_user_id', actor.userId)
      .select('id')
      .single(),
    `accept synthetic terms for actor ${label}`,
  )
  const restaurant = await requireNoError(
    admin.from('restaurants').insert({
      workspace_id: actor.workspaceId,
      name: `Synthetic Browser Location ${label}`,
      place_id: `playbook-browser-${label.toLowerCase()}-${runId}`,
      owner_email: actor.email,
      active: true,
    }).select('id').single(),
    `create browser fixture location ${label}`,
  ) as { id: string }
  actor.restaurantId = restaurant.id
  return actor
}

class PageMonitor {
  private expected = new Map<string, number>()
  private expectedConsoleStatuses = new Map<number, number>()
  private failures: string[] = []
  private consoleErrors: string[] = []
  private pageErrors: string[] = []
  private forbiddenSecret: string
  private allowedHosts: Set<string>

  constructor(page: Page, origin: string, environment: Environment) {
    this.forbiddenSecret = environment.SUPABASE_SERVICE_ROLE_KEY
    this.allowedHosts = new Set([
      new URL(origin).host,
      `${EXPECTED_PROJECT_REF}.supabase.co`,
    ])
    page.on('console', message => {
      if (message.type() !== 'error') return
      const statusMatch = message.text().match(/status of (\d+)/i)
      const status = statusMatch ? Number(statusMatch[1]) : 0
      const remaining = this.expectedConsoleStatuses.get(status) ?? 0
      if (remaining > 0) {
        if (remaining === 1) this.expectedConsoleStatuses.delete(status)
        else this.expectedConsoleStatuses.set(status, remaining - 1)
        return
      }
      this.consoleErrors.push(message.text())
    })
    page.on('pageerror', error => this.pageErrors.push(error.message))
    page.on('requestfailed', request => {
      this.failures.push(`${request.method()} ${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? 'failed'}`)
    })
    page.on('request', request => this.inspectRequest(request))
    page.on('response', response => this.inspectResponse(response))
  }

  allow(method: string, pathname: string, status: number, count = 1) {
    const key = `${method.toUpperCase()} ${pathname} ${status}`
    this.expected.set(key, (this.expected.get(key) ?? 0) + count)
    this.expectedConsoleStatuses.set(
      status,
      (this.expectedConsoleStatuses.get(status) ?? 0) + count,
    )
  }

  private inspectRequest(request: Request) {
    const url = new URL(request.url())
    if (!this.allowedHosts.has(url.host)) {
      this.failures.push(`unexpected external request to ${url.host}`)
    }
    const serialized = `${request.url()}\n${request.postData() ?? ''}\n${JSON.stringify(request.headers())}`
    if (serialized.includes(this.forbiddenSecret)) {
      this.failures.push('service-role credential appeared in a browser request')
    }
    if (serialized.includes(PRODUCTION_PROJECT_REF)) {
      this.failures.push('Production project reference appeared in a browser request')
    }
  }

  private inspectResponse(response: Response) {
    if (response.status() < 400) return
    const url = new URL(response.url())
    const key = `${response.request().method()} ${url.pathname} ${response.status()}`
    const remaining = this.expected.get(key) ?? 0
    if (remaining > 0) {
      if (remaining === 1) this.expected.delete(key)
      else this.expected.set(key, remaining - 1)
      return
    }
    this.failures.push(`unexpected HTTP ${response.status()} for ${response.request().method()} ${url.pathname}`)
  }

  async assertClean(label: string) {
    await new Promise(resolve => setTimeout(resolve, 250))
    assert.deepEqual([...this.expected.entries()], [], `${label}: expected negative responses were not observed`)
    assert.deepEqual(this.failures, [], `${label}: ${this.failures.join(' | ')}`)
    assert.deepEqual(this.consoleErrors, [], `${label} console errors: ${this.consoleErrors.join(' | ')}`)
    assert.deepEqual(this.pageErrors, [], `${label} page errors: ${this.pageErrors.join(' | ')}`)
  }
}

async function browserApi<T>(
  page: Page,
  method: 'GET' | 'POST',
  pathname: string,
  body?: unknown,
): Promise<BrowserApiResult<T>> {
  return page.evaluate(async ({ requestMethod, requestPath, requestBody }) => {
    const response = await fetch(requestPath, {
      method: requestMethod,
      headers: requestBody === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    })
    let parsed: unknown = null
    try {
      parsed = await response.json()
    } catch {
      parsed = null
    }
    return { status: response.status, body: parsed }
  }, { requestMethod: method, requestPath: pathname, requestBody: body }) as Promise<BrowserApiResult<T>>
}

async function loadBrowserState(page: Page, workspaceId: string) {
  const result = await browserApi<{ state: PlaybookState; error?: string }>(
    page,
    'GET',
    `/api/playbook?workspaceId=${encodeURIComponent(workspaceId)}`,
  )
  assert.equal(result.status, 200)
  assert.ok(result.body.state)
  return result.body.state
}

function snapshotFromProcedure(procedure: PlaybookProcedure) {
  return {
    title: procedure.title,
    category: procedure.category,
    description: procedure.description,
    objective: procedure.objective,
    steps: procedure.steps,
    responsible_role_id: procedure.responsible_role_id,
    assigned_person_id: procedure.assigned_person_id,
    status: procedure.status,
  }
}

async function navigateFromDashboardToPersistentPlaybook(page: Page) {
  await page.goto('/dashboard')
  await page.getByRole('button', { name: /Switch feature\. Current feature:/ }).click()
  await page.getByRole('menuitem', { name: /Business Playbook/ }).click()
  await page.waitForURL(url => url.pathname === '/dashboard/playbook')
  assert.equal(new URL(page.url()).pathname, '/dashboard/playbook')
  await page.getByRole('heading', { name: 'Business Playbook', exact: true }).waitFor()
  assert.equal(await page.locator('[data-demo="false"]').count(), 1)
}

async function addAndEditDirectoryEntries(
  page: Page,
  roleName: string,
  personName: string,
) {
  await page.getByRole('button', { name: 'People & roles' }).click()
  const dialog = page.getByRole('dialog', { name: 'People and roles' })
  await dialog.getByLabel('Role name').fill(roleName)
  await dialog.getByLabel('Department').fill('Synthetic Operations')
  await dialog.getByLabel('Responsibilities').fill('Own synthetic browser handoffs.')
  await dialog.getByRole('button', { name: 'Add role' }).click()
  await page.getByRole('status').filter({ hasText: 'Role added.' }).waitFor()

  const roleArticle = dialog.locator('article').filter({ hasText: roleName })
  await roleArticle.getByRole('button', { name: 'Edit' }).click()
  await dialog.getByLabel('Responsibilities').fill('Own and audit synthetic browser handoffs.')
  await dialog.getByRole('button', { name: 'Save role' }).click()
  await page.getByRole('status').filter({ hasText: 'Role updated.' }).waitFor()

  await dialog.getByRole('button', { name: 'People', exact: true }).click()
  await dialog.getByLabel('Name').fill(personName)
  await dialog.getByLabel('Job title').fill('Synthetic Coordinator')
  await dialog.getByLabel('Department').fill('Synthetic Operations')
  await dialog.getByRole('combobox').selectOption({ label: roleName })
  await dialog.getByLabel('Responsibilities').fill('Complete synthetic browser checks.')
  await dialog.getByRole('button', { name: 'Add person' }).click()
  await page.getByRole('status').filter({ hasText: 'Employee directory entry added.' }).waitFor()

  const personArticle = dialog.locator('article').filter({ hasText: personName })
  await personArticle.getByRole('button', { name: 'Edit' }).click()
  await dialog.getByLabel('Job title').fill('Senior Synthetic Coordinator')
  await dialog.getByRole('button', { name: 'Save person' }).click()
  await page.getByRole('status').filter({ hasText: 'Directory entry updated.' }).waitFor()
  await dialog.getByRole('button', { name: 'Close People and roles' }).click()
}

async function createAndEditProcedure(
  page: Page,
  title: string,
  roleName: string,
  personName: string,
) {
  await page.getByRole('button', { name: 'New procedure' }).last().click()
  let dialog = page.getByRole('dialog', { name: 'New procedure' })
  await dialog.getByLabel('Procedure title').fill(title)
  await dialog.getByLabel('Category').selectOption({ index: 1 })
  await dialog.getByLabel('Status').selectOption('active')
  await dialog.getByLabel('Summary').fill('Synthetic browser procedure for durable staging validation.')
  await dialog.getByLabel('Purpose').fill('Confirm the real application persists owner-controlled procedures.')
  await dialog.getByLabel('Responsible role').selectOption({ label: roleName })
  await dialog.getByLabel('Person (optional)').selectOption({ label: personName })
  await dialog.getByLabel(/Steps/).fill('Record the synthetic request.\nConfirm the synthetic owner.')
  await dialog.getByLabel('Change note').fill('Initial synthetic browser procedure')
  await dialog.getByRole('button', { name: 'Create procedure' }).click()
  await page.getByRole('status').filter({ hasText: 'Procedure created with version 1.' }).waitFor()
  await page.getByRole('heading', { name: title }).waitFor()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  dialog = page.getByRole('dialog', { name: 'Edit procedure' })
  await dialog.getByLabel('Summary').fill('Edited through the real browser UI and stored in Supabase staging.')
  await dialog.getByLabel(/Steps/).fill(
    'Record the synthetic request.\nConfirm the synthetic owner.\nRecord completion in the Playbook.',
  )
  await dialog.getByLabel('Change note').fill('Browser UI procedure revision')
  await dialog.getByRole('button', { name: 'Save new version' }).click()
  await page.getByRole('status').filter({ hasText: 'Procedure version saved.' }).waitFor()
  await page.getByText('Version 2', { exact: true }).waitFor()
}

async function run() {
  const environment = parseEnvFile(envPath)
  validateEnvironment(environment)
  const admin = adminClient(environment)
  const staleCleanup = await cleanupFixtures(admin)
  if (staleCleanup.users || staleCleanup.workspaces || staleCleanup.accounts) {
    console.log('[staging-playbook-browser] removed stale synthetic browser fixtures')
  }

  await buildApp(environment)
  const port = await findFreePort()
  let server: AppServer | null = await startApp(environment, port)
  let browser: Browser | null = null
  let actorA: TestActor | null = null
  let actorB: TestActor | null = null
  let mobileContext: BrowserContext | null = null
  let testFailure: unknown = null
  const runId = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const artifactDirectory = path.join(artifactRoot, runId)
  mkdirSync(artifactDirectory, { recursive: true })
  const screenshots = {
    desktop: path.join(artifactDirectory, 'desktop-playbook.png'),
    mobile: path.join(artifactDirectory, 'iphone-playbook.png'),
  }

  try {
    browser = await chromium.launch({
      executablePath: findChromeExecutable(),
      headless: true,
      args: ['--disable-background-networking'],
    })

    const anonymousContext = await browser.newContext({ baseURL: server.origin })
    const anonymousPage = await anonymousContext.newPage()
    const anonymousMonitor = new PageMonitor(anonymousPage, server.origin, environment)
    await anonymousPage.goto('/dashboard/playbook')
    await anonymousPage.waitForURL(url => url.pathname === '/signin')
    anonymousMonitor.allow('GET', '/api/playbook', 401)
    const anonymousApi = await browserApi(
      anonymousPage,
      'GET',
      `/api/playbook?workspaceId=00000000-0000-4000-8000-000000000000`,
    )
    assert.equal(anonymousApi.status, 401)
    await anonymousMonitor.assertClean('anonymous browser')
    await anonymousContext.close()
    pass('anonymous dashboard and Playbook API access are rejected')

    actorA = await createActor(admin, environment, browser, server, 'A', runId)
    actorB = await createActor(admin, environment, browser, server, 'B', runId)

    const identityRows = await requireNoError(
      admin.from('business_workspaces')
        .select('id, account_id')
        .in('id', [actorA.workspaceId, actorB.workspaceId]),
      'verify synthetic workspace ownership',
    ) as Array<{ id: string; account_id: string }>
    assert.deepEqual(
      identityRows.map(row => `${row.id}:${row.account_id}`).sort(),
      [
        `${actorA.workspaceId}:${actorA.accountId}`,
        `${actorB.workspaceId}:${actorB.accountId}`,
      ].sort(),
    )
    pass('two confirmed synthetic Auth users each own exactly one isolated workspace')

    const pageA = await actorA.context.newPage()
    const monitorA = new PageMonitor(pageA, server.origin, environment)
    await navigateFromDashboardToPersistentPlaybook(pageA)
    await pageA.getByRole('heading', { name: 'No procedures yet' }).waitFor()
    assert.equal(
      await pageA.evaluate(() => Object.keys(window.localStorage).some(key => /playbook/i.test(key))),
      false,
    )
    pass('dashboard navigation opens the persistent Playbook, not the browser-local demo')

    const roleAName = `Synthetic Service Owner A ${runId}`
    const personAName = `Synthetic Person A ${runId}`
    const procedureTitle = `Synthetic Update Procedure ${runId}`
    await addAndEditDirectoryEntries(pageA, roleAName, personAName)
    await createAndEditProcedure(pageA, procedureTitle, roleAName, personAName)
    pass('real browser UI created and edited roles, people, and a procedure')

    let stateA = await loadBrowserState(pageA, actorA.workspaceId)
    let procedureA = stateA.procedures.find(item => item.title === procedureTitle)
    assert.ok(procedureA)
    const roleA = stateA.roles.find(item => item.name === roleAName)
    const personA = stateA.people.find(item => item.display_name === personAName)
    assert.ok(roleA)
    assert.ok(personA)

    await pageA.getByRole('button', { name: 'Edit', exact: true }).click()
    const staleDialog = pageA.getByRole('dialog', { name: 'Edit procedure' })
    const concurrent = await browserApi(
      pageA,
      'POST',
      '/api/playbook',
      {
        workspaceId: actorA.workspaceId,
        action: 'procedure.update',
        payload: {
          id: procedureA.id,
          expected_lock_version: procedureA.lock_version,
          snapshot: snapshotFromProcedure(procedureA),
          change_summary: 'Concurrent synthetic browser revision',
        },
      },
    )
    assert.equal(concurrent.status, 200)
    await staleDialog.getByLabel('Change note').fill('Stale browser revision must be rejected')
    monitorA.allow('POST', '/api/playbook', 409)
    await staleDialog.getByRole('button', { name: 'Save new version' }).click()
    await pageA.getByRole('alert').filter({ hasText: 'This record changed in another request.' }).waitFor()
    await pageA.reload()
    await pageA.getByRole('heading', { name: procedureTitle }).waitFor()
    pass('stale procedure updates produce a visible conflict and do not overwrite newer data')

    const procedureId = procedureA.id
    stateA = await loadBrowserState(pageA, actorA.workspaceId)
    procedureA = stateA.procedures.find(item => item.id === procedureId)
    assert.ok(procedureA)

    const now = Date.now()
    const reviewsA = await requireNoError(
      admin.from('reviews').insert([
        {
          restaurant_id: actorA.restaurantId,
          author: 'Synthetic Browser Reviewer A1',
          rating: 2,
          review_text: 'Synthetic feedback: the promised status update arrived late.',
          review_timestamp: now - 86_400_000,
          google_review_name: `playbook-browser-${runId}-a1`,
        },
        {
          restaurant_id: actorA.restaurantId,
          author: 'Synthetic Browser Reviewer A2',
          rating: 3,
          review_text: 'Synthetic feedback: a clearer progress update would have helped.',
          review_timestamp: now - 172_800_000,
          google_review_name: `playbook-browser-${runId}-a2`,
        },
      ]).select('id, rating, review_text, review_timestamp'),
      'create synthetic browser feedback evidence A',
    ) as Array<{ id: string; rating: number; review_text: string; review_timestamp: number }>
    const reviewB = await requireNoError(
      admin.from('reviews').insert({
        restaurant_id: actorB.restaurantId,
        author: 'Synthetic Browser Reviewer B1',
        rating: 4,
        review_text: 'Synthetic workspace B feedback must remain isolated.',
        review_timestamp: now - 86_400_000,
        google_review_name: `playbook-browser-${runId}-b1`,
      }).select('id').single(),
      'create synthetic browser feedback evidence B',
    ) as { id: string }

    const proposalProblem = 'Synthetic staging feedback reports unclear status-update ownership.'
    const rawProposal: RawPlaybookProposal = {
      proposalKind: 'change_procedure',
      procedureId: procedureA.id,
      problem: proposalProblem,
      proposedSnapshot: {
        title: procedureA.title,
        category: procedureA.category,
        description: 'Document each promised customer update and its completion.',
        objective: procedureA.objective,
        steps: [...procedureA.steps, 'Escalate a missed update during the same synthetic shift.'],
        responsibleRoleId: roleA.id,
        assignedPersonId: personA.id,
        status: procedureA.status,
      },
      expectedBenefit: 'Explicit ownership may reduce missed synthetic updates.',
      priority: 'high',
      rationale: 'Two synthetic feedback records describe the same handoff gap.',
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
    const unauthorizedEvidence = await admin.rpc('playbook_create_ai_proposals', {
      p_workspace_id: actorA.workspaceId,
      p_actor_id: actorA.userId,
      p_model: 'staging-browser-deterministic-fixture',
      p_proposals: [{ ...normalized[0], evidence_ids: [reviewsA[0].id, reviewB.id] }],
    })
    assert.ok(unauthorizedEvidence.error)
    assert.match(unauthorizedEvidence.error.message, /unauthorized_evidence/)
    await requireNoError(
      admin.rpc('playbook_create_ai_proposals', {
        p_workspace_id: actorA.workspaceId,
        p_actor_id: actorA.userId,
        p_model: 'staging-browser-deterministic-fixture',
        p_proposals: normalized,
      }),
      'persist deterministic browser proposal through hardened RPC',
    )
    pass('deterministic no-OpenAI proposal persisted with authorized evidence only')

    await pageA.reload()
    await pageA.getByRole('link', { name: 'Needs action' }).click()
    await pageA.waitForURL(url => url.searchParams.get('view') === 'review')
    await pageA.getByRole('button', { name: new RegExp(proposalProblem) }).click()
    const proposalState = await loadBrowserState(pageA, actorA.workspaceId)
    const proposal = proposalState.proposals.find(item => item.model === 'staging-browser-deterministic-fixture')
    assert.ok(proposal)
    monitorA.allow('POST', '/api/playbook', 409)
    const invalidApply = await browserApi(
      pageA,
      'POST',
      '/api/playbook',
      {
        workspaceId: actorA.workspaceId,
        action: 'proposal.apply',
        payload: {
          id: proposal.id,
          expected_lock_version: proposal.lock_version,
          expected_procedure_lock_version: procedureA.lock_version,
          change_summary: 'Pending proposal must not apply',
        },
      },
    )
    assert.equal(invalidApply.status, 409)

    let proposalDialog = pageA.getByRole('dialog', { name: 'Review suggestion' })
    await proposalDialog.getByText('Supporting feedback').click()
    await proposalDialog.locator('summary').filter({
      hasText: 'Synthetic feedback: the promised status update arrived late.',
    }).click()
    await proposalDialog.locator('p').getByText(
      'Synthetic feedback: the promised status update arrived late.',
      { exact: true },
    ).waitFor()
    assert.equal(await proposalDialog.getByText('Synthetic workspace B feedback must remain isolated.').count(), 0)
    await proposalDialog.getByRole('button', { name: 'Edit', exact: true }).click()
    await proposalDialog.getByLabel('Why this may help').fill(
      'Edited in the browser: explicit ownership may reduce missed synthetic updates.',
    )
    await proposalDialog.getByLabel('Suggested summary').fill(
      'Browser-edited proposal summary with a documented completion check.',
    )
    await proposalDialog.getByRole('button', { name: 'Save edits' }).click()
    await pageA.getByRole('status').filter({ hasText: 'Suggestion edits saved.' }).waitFor()
    await proposalDialog.getByRole('button', { name: 'Approve proposal' }).click()
    await pageA.getByRole('status').filter({ hasText: 'Suggestion approved.' }).waitFor()

    await proposalDialog.getByRole('button', { name: 'Create linked task' }).click()
    let taskDialog = pageA.getByRole('dialog', { name: 'New task' })
    const taskTitle = `Verify approved synthetic change ${runId}`
    await taskDialog.getByLabel('Task title').fill(taskTitle)
    await taskDialog.getByLabel('Notes (optional)').fill('Created from the approved synthetic proposal.')
    await taskDialog.getByLabel('Owner').selectOption({ label: personAName })
    await taskDialog.getByLabel('Status').selectOption('in_progress')
    await taskDialog.getByLabel('Priority').selectOption('high')
    await taskDialog.getByRole('button', { name: 'Create task' }).click()
    await pageA.getByRole('status').filter({ hasText: 'Improvement task created.' }).waitFor()

    await pageA.getByRole('button', { name: new RegExp(proposalProblem) }).click()
    proposalDialog = pageA.getByRole('dialog', { name: 'Review suggestion' })
    await proposalDialog.getByRole('button', { name: 'Update procedure' }).click()
    await pageA.getByRole('status').filter({ hasText: 'Approved change applied as a new procedure version.' }).waitFor()
    pass('browser UI edited, approved, and separately applied a proposal with linked evidence')

    await pageA.getByRole('link', { name: 'Tasks', exact: true }).click()
    await pageA.getByRole('row', { name: new RegExp(taskTitle) }).click()
    taskDialog = pageA.getByRole('dialog', { name: 'Task details' })
    await taskDialog.getByLabel('Notes (optional)').fill('Completed through the real browser task editor.')
    await taskDialog.getByLabel('Status').selectOption('done')
    await taskDialog.getByRole('button', { name: 'Save task' }).click()
    await pageA.getByRole('status').filter({ hasText: 'Task updated.' }).waitFor()
    await pageA.getByRole('row', { name: new RegExp(`${taskTitle}.*Done`, 's') }).waitFor()
    pass('browser UI created and completed a proposal-linked improvement task')

    await pageA.getByRole('link', { name: 'All procedures' }).click()
    await pageA.getByRole('heading', { name: procedureTitle }).waitFor()
    await pageA.locator('summary[aria-label="More procedure actions"]').click()
    await pageA.getByRole('menuitem', { name: 'Version history' }).click()
    const historyDialog = pageA.getByRole('dialog', { name: 'Procedure history' })
    await historyDialog.waitFor()
    const historyState = await loadBrowserState(pageA, actorA.workspaceId)
    assert.equal(historyState.procedures.find(item => item.id === procedureA.id)?.current_version, 4)
    assert.equal(historyState.versions.filter(item => item.procedure_id === procedureA.id).length, 4)
    const historyText = await historyDialog.textContent()
    assert.match(historyText ?? '', /Version 4/)
    assert.match(historyText ?? '', /Applied approved proposal:/)
    await historyDialog.getByRole('button', { name: 'Close Procedure history' }).click()
    pass('version history exposes all four immutable procedure versions')

    const pageB = await actorB.context.newPage()
    const monitorB = new PageMonitor(pageB, server.origin, environment)
    let releasePlaybookRequest: (() => void) | undefined
    const requestGate = new Promise<void>(resolve => { releasePlaybookRequest = resolve })
    await pageB.route('**/api/playbook?**', async route => {
      await requestGate
      await route.continue()
    }, { times: 1 })
    const navigationB = pageB.goto('/dashboard/playbook')
    await pageB.getByLabel('Loading Business Playbook').waitFor()
    releasePlaybookRequest?.()
    await navigationB
    await pageB.getByRole('heading', { name: 'No procedures yet' }).waitFor()
    pass('real loading and empty states render before and after the hosted staging response')

    const roleBName = `Synthetic Isolated Role B ${runId}`
    await pageB.getByRole('button', { name: 'People & roles' }).click()
    const directoryB = pageB.getByRole('dialog', { name: 'People and roles' })
    await directoryB.getByLabel('Role name').fill(roleBName)
    await directoryB.getByLabel('Department').fill('Isolated Workspace B')
    await directoryB.getByRole('button', { name: 'Add role' }).click()
    await pageB.getByRole('status').filter({ hasText: 'Role added.' }).waitFor()
    await directoryB.getByRole('button', { name: 'Close People and roles' }).click()
    assert.equal(await pageB.getByText(procedureTitle).count(), 0)

    monitorB.allow('GET', '/api/playbook', 403)
    const crossRead = await browserApi(
      pageB,
      'GET',
      `/api/playbook?workspaceId=${encodeURIComponent(actorA.workspaceId)}`,
    )
    assert.equal(crossRead.status, 403)
    monitorB.allow('POST', '/api/playbook', 403)
    const crossWrite = await browserApi(
      pageB,
      'POST',
      '/api/playbook',
      {
        workspaceId: actorA.workspaceId,
        action: 'role.update',
        payload: { id: roleA.id, name: 'Unauthorized cross-workspace edit' },
      },
    )
    assert.equal(crossWrite.status, 403)
    await pageA.reload()
    assert.equal(await pageA.getByText(roleBName).count(), 0)
    pass('separate authenticated browser sessions cannot read or modify another workspace')

    const stateBeforeRestart = await loadBrowserState(pageA, actorA.workspaceId)
    assert.equal(stateBeforeRestart.procedures.find(item => item.id === procedureA.id)?.current_version, 4)
    assert.equal(stateBeforeRestart.tasks.find(item => item.title === taskTitle)?.status, 'done')
    assert.equal(
      await pageA.evaluate(() => Object.keys(window.localStorage).some(key => /playbook/i.test(key))),
      false,
    )

    await pageA.setViewportSize({ width: 1440, height: 1000 })
    await pageA.goto('/dashboard/playbook')
    await pageA.getByRole('heading', { name: procedureTitle }).waitFor()
    assert.equal(
      await pageA.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      true,
    )
    await pageA.screenshot({ path: screenshots.desktop, fullPage: true })

    const storageState = await actorA.context.storageState()
    mobileContext = await browser.newContext({
      baseURL: server.origin,
      storageState,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
      colorScheme: 'light',
      reducedMotion: 'reduce',
    })
    const mobilePage = await mobileContext.newPage()
    const mobileMonitor = new PageMonitor(mobilePage, server.origin, environment)
    await mobilePage.goto('/dashboard/playbook')
    await mobilePage.getByRole('heading', { name: procedureTitle }).waitFor()
    assert.equal(
      await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      true,
    )
    await mobilePage.getByRole('button', { name: 'Browse procedures' }).click()
    await mobilePage.getByRole('button', { name: procedureTitle }).click()
    await mobilePage.getByRole('button', { name: 'Edit', exact: true }).click()
    await mobilePage.getByRole('dialog', { name: 'Edit procedure' }).waitFor()
    await mobilePage.getByRole('button', { name: 'Close Edit procedure' }).click()
    await mobilePage.screenshot({ path: screenshots.mobile, fullPage: true })
    await mobileMonitor.assertClean('mobile browser')
    await mobileContext.close()
    mobileContext = null
    pass('desktop and iPhone-size layouts support navigation, scrolling, forms, and touch clicks')

    await stopApp(server)
    server = await startApp(environment, port)
    await pageA.reload()
    await pageA.getByRole('heading', { name: procedureTitle }).waitFor()
    await pageA.getByRole('link', { name: 'Tasks', exact: true }).click()
    await pageA.getByRole('row', { name: new RegExp(taskTitle) }).waitFor()
    pass('procedure and task data remain available after a complete application restart')

    await pageA.getByRole('button', { name: 'Open account menu' }).click()
    await pageA.getByRole('menuitem', { name: 'Sign out' }).click()
    await pageA.waitForURL(url => url.pathname === '/signin')
    await exchangeApplicationSession(actorA, server.origin)
    await pageA.goto('/dashboard/playbook')
    await pageA.getByRole('heading', { name: procedureTitle }).waitFor()
    pass('sign-out invalidates the browser view and a fresh valid session retains Playbook data')

    const scriptUrls = await pageA.evaluate(() =>
      Array.from(document.scripts).map(script => script.src).filter(Boolean),
    )
    const clientSources = [await pageA.content()]
    for (const url of scriptUrls) {
      if (new URL(url).host !== new URL(server.origin).host) continue
      const scriptResponse: APIResponse = await actorA.context.request.get(url)
      assert.equal(scriptResponse.ok(), true)
      clientSources.push(await scriptResponse.text())
    }
    const browserBundle = clientSources.join('\n')
    assert.equal(browserBundle.includes(environment.SUPABASE_SERVICE_ROLE_KEY), false)
    assert.equal(browserBundle.includes(PRODUCTION_PROJECT_REF), false)
    pass('service-role credentials and the Production project reference are absent from browser HTML and scripts')

    const persistedProcedure = await requireNoError(
      admin.from('playbook_procedures')
        .select('id, workspace_id, current_version')
        .eq('id', procedureA.id)
        .eq('workspace_id', actorA.workspaceId)
        .single(),
      'verify persisted browser procedure',
    ) as { id: string; workspace_id: string; current_version: number }
    const persistedTask = await requireNoError(
      admin.from('playbook_tasks')
        .select('id, workspace_id, status')
        .eq('workspace_id', actorA.workspaceId)
        .eq('title', taskTitle)
        .single(),
      'verify persisted browser task',
    ) as { id: string; workspace_id: string; status: string }
    assert.equal(persistedProcedure.current_version, 4)
    assert.equal(persistedTask.status, 'done')
    pass('direct staging reads confirm browser changes are durable Supabase records')

    await monitorA.assertClean('actor A browser')
    await monitorB.assertClean('actor B browser')
    pass('browser console and network audit found no unexpected errors or external requests')

    console.log(JSON.stringify({
      target: { project: EXPECTED_PROJECT_NAME, ref: EXPECTED_PROJECT_REF },
      browser: 'installed Chromium browser via playwright-core',
      databasePersistence: 'real Supabase staging',
      aiGeneration: 'deterministic normalized fixture; no OpenAI request',
      externalIntegrations: 'disabled',
      fixtureRetention: 'none',
      screenshots,
      checks,
    }, null, 2))
  } catch (error) {
    testFailure = error
    console.error(`[staging-playbook-browser] assertion failed: ${error instanceof Error ? error.message : String(error)}`)
    if (server?.logs.length) {
      console.error(`[staging-playbook-browser] server log tail: ${server.logs.slice(-30).join(' | ')}`)
    }
  } finally {
    await mobileContext?.close().catch(() => undefined)
    await actorA?.context.close().catch(() => undefined)
    await actorB?.context.close().catch(() => undefined)
    await browser?.close().catch(() => undefined)
    await stopApp(server)
    try {
      const cleanup = await cleanupFixtures(admin)
      const remainingUsers = await listFixtureAuthUsers(admin)
      const remainingAccounts = await admin.from('accounts')
        .select('id', { count: 'exact', head: true })
        .like('owner_email', `${FIXTURE_EMAIL_PREFIX}%${FIXTURE_EMAIL_SUFFIX}`)
      if (remainingAccounts.error) {
        throw new Error(`Unable to verify browser fixture account cleanup: ${remainingAccounts.error.message}`)
      }
      assert.equal(remainingUsers.length, 0)
      assert.equal(remainingAccounts.count, 0)
      console.log(`[staging-playbook-browser] synthetic fixtures removed (${cleanup.users} users, ${cleanup.workspaces} workspaces)`)
    } catch (cleanupError) {
      if (testFailure) {
        throw new AggregateError([testFailure, cleanupError], 'Browser test and cleanup both failed')
      }
      throw cleanupError
    }
  }

  if (testFailure) throw testFailure
}

async function main() {
  try {
    await run()
  } catch (error) {
    console.error(`Staging Playbook browser E2E failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

const keepAlive = setInterval(() => undefined, 1_000)
void main().finally(() => clearInterval(keepAlive))
