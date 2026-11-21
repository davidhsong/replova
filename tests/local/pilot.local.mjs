import { createServer } from 'node:http'
import { createServer as createSocketServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { rehearse } from './pilotBrowser.mjs'
import { benchmark } from './pilotVolume.mjs'
import { sentimentReplay } from './pilotSentimentReplay.mjs'
import { commentSentimentCheck } from './pilotCommentSentiment.mjs'
import { scopedAnalysis } from './pilotScope.mjs'
import { createHmac, randomUUID, randomBytes } from 'node:crypto'
import {
  readFileSync,
  readdirSync,
  mkdtempSync,
  cpSync,
  symlinkSync,
  openSync,
  closeSync,
  rmSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
const root = process.cwd(),
  tools = process.env.PILOT_LOCAL_TOOLS || path.join(tmpdir(), 'replova-pilot-local'),
  lab = mkdtempSync(path.join(tmpdir(), 'replova-run-'))
const { default: Embedded } = await import(
  pathToFileURL(path.join(tools, 'node_modules/embedded-postgres/dist/index.js'))
)
const userId = randomUUID(),
  password = randomBytes(20).toString('hex'),
  secret = randomBytes(40).toString('hex'),
  cron = randomUUID(),
  origin = 'http://127.0.0.1:3673'
const portProbe = createSocketServer()
await new Promise((ok) => portProbe.listen(0, '127.0.0.1', ok))
const databasePort = portProbe.address().port
await new Promise((ok) => portProbe.close(ok))
const pg = new Embedded({
  databaseDir: path.join(lab, 'db'),
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-c', 'io_method=sync'],
  port: databasePort,
  user: 'postgres',
  password,
  persistent: true,
  onLog: () => {},
  onError: console.error,
  autoRehydrateSymlinks: true,
})
const children = []
let client, proxy, fd
async function close() {
  for (const child of children.reverse()) {
    if (child.exitCode !== null || !child.pid) continue
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    else child.kill()
  }
  if (proxy?.listening) {
    proxy.closeAllConnections()
    await new Promise((ok) => proxy.close(ok))
  }
  await client?.end()
  await pg.stop()
  if (fd !== undefined) closeSync(fd)
  // The directory was allocated exclusively by mkdtemp for this invocation.
  if (
    path.dirname(path.resolve(lab)) === path.resolve(tmpdir()) &&
    path.basename(lab).startsWith('replova-run-')
  ) {
    rmSync(lab, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 })
  }
}
try {
  await pg.initialise()
  await pg.start()
  client = pg.getPgClient()
  await client.connect()
  const prelude = readFileSync('tests/sql/localSupabase.sql', 'utf8')
  await client.query(prelude)
  for (const f of readdirSync('supabase/migrations').sort())
    await client.query(
      readFileSync('supabase/migrations/' + f, 'utf8').replace(
        /CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;/gi,
        '',
      ),
    )
  const email = 'owner@example.invalid',
    stamp = new Date().toISOString()
  await client.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
    userId,
    email,
  ])
  await client.query(
    "select * from provision_replova_account_workspace($1,$2,'Pilot Studio','growth')",
    [userId, email],
  )
  await client.query('update accounts set terms_accepted_at=now()')
  function jwt(role, sub) {
    const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'),
      h =
        b({ alg: 'HS256', typ: 'JWT' }) +
        '.' +
        b({ role, sub, exp: Math.floor(Date.now() / 1000) + 7200 })
    return h + '.' + createHmac('sha256', secret).update(h).digest('base64url')
  }
  const service = jwt('service_role'),
    anon = jwt('anon'),
    token = jwt('authenticated', userId)
  const actor = {
    id: userId,
    email,
    aud: 'authenticated',
    role: 'authenticated',
    created_at: stamp,
    email_confirmed_at: stamp,
    app_metadata: { provider: 'email' },
    user_metadata: {},
  }
  const session = {
    access_token: token,
    refresh_token: randomUUID(),
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    expires_in: 7200,
    token_type: 'bearer',
    user: actor,
  }
  fd = openSync(path.join(lab, 'services.log'), 'w')
  children.push(
    spawn(
      process.env.POSTGREST_BIN ||
        path.join(tools, 'bin', process.platform === 'win32' ? 'postgrest.exe' : 'postgrest'),
      [],
      {
        windowsHide: true,
        stdio: ['ignore', fd, fd],
        env: {
          ...process.env,
          PATH:
            process.platform === 'win32'
              ? path.join(tools, 'node_modules/@embedded-postgres/windows-x64/native/bin') +
                ';' +
                process.env.PATH
              : process.env.PATH,
          PGRST_DB_URI: 'postgres://postgres:' + password + '@127.0.0.1:' + databasePort + '/postgres',
          PGRST_DB_SCHEMAS: 'public',
          PGRST_DB_ANON_ROLE: 'anon',
          PGRST_JWT_SECRET: secret,
          PGRST_SERVER_PORT: '3675',
          PGRST_SERVER_HOST: '127.0.0.1',
        },
      },
    ),
  )
  let failedAnalysis = false
  const volume = process.argv.includes('--volume')
  const replayIndex = process.argv.indexOf('--replay-analysis')
  const replay = replayIndex >= 0 ? sentimentReplay(process.argv[replayIndex + 1]) : null
  const sentiment = process.argv.includes('--comment-sentiment') ? commentSentimentCheck() : null
  const failedOnce = new Set()
  const scopedCalls = []
  proxy = createServer(async (req, res) => {
    try {
      if (req.url === '/auth/v1/user' && req.headers.authorization === 'Bearer ' + token) {
        res.setHeader('content-type', 'application/json')
        return res.end(JSON.stringify(actor))
      }
      if (req.url === '/v1/responses') {
        let body = ''
        for await (const c of req) body += c
        const request = JSON.parse(body)
        const input = JSON.parse(request.input)
        if (process.argv.includes('--scoped-analysis')) scopedCalls.push(input.comment)
        if (volume) await delay(100)
        const inject = volume && /visit (0|17|34)$/.test(input.comment) && !failedOnce.has(input.comment)
        if (inject || (input.comment.includes('by the window') && !failedAnalysis)) {
          failedOnce.add(input.comment)
          failedAnalysis = true
          res.setHeader('content-type', 'application/json')
          return res.end(
            JSON.stringify({ id: 'sample', object: 'response', status: 'completed', output: [] }),
          )
        }
        const output = sentiment?.response(request) ?? replay?.response(input) ?? {
          sentiment: 'negative',
          urgent: true,
          themes: [{ name: 'Pests and hygiene', excerpt: input.comment }],
        }
        res.setHeader('content-type', 'application/json')
        return res.end(
          JSON.stringify({
            id: 'sample',
            object: 'response',
            status: 'completed',
            output: [
              { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] },
            ],
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        )
      }
      if (!req.url.startsWith('/rest/v1/')) {
        res.writeHead(404)
        return res.end()
      }
      let body = ''
      for await (const c of req) body += c
      const h = { ...req.headers }
      delete h.host
      delete h['content-length']
      delete h.connection
      const r = await fetch('http://127.0.0.1:3675' + req.url.slice(8), {
        method: req.method,
        headers: h,
        body: body || undefined,
      })
      res.writeHead(
        r.status,
        Object.fromEntries(
          [...r.headers].filter(
            ([k]) =>
              !['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(
                k,
              ),
          ),
        ),
      )
      res.end(Buffer.from(await r.arrayBuffer()))
    } catch (e) {
      res.writeHead(502)
      res.end(String(e))
    }
  })
  await new Promise((ok) => proxy.listen(3674, '127.0.0.1', ok))
  const site = path.join(lab, 'site')
  for (const f of [
    'app',
    'components',
    'public',
    'lib',
    'utils',
    'proxy.ts',
    'next.config.ts',
    'tsconfig.json',
    'package.json',
    'postcss.config.mjs',
  ])
    cpSync(f, path.join(site, f), { recursive: true })
  symlinkSync(path.join(root, 'node_modules'), path.join(site, 'node_modules'), 'junction')
  const env = {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3674',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
    SUPABASE_SERVICE_ROLE_KEY: service,
    NEXT_PUBLIC_BASE_URL: origin,
    CRON_SECRET: cron,
    OPENAI_API_KEY: 'fixture-only',
    OPENAI_BASE_URL: 'http://127.0.0.1:3674/v1',
    NEXT_TELEMETRY_DISABLED: '1',
  }
  for (const key of [
    'GOOGLE_PLACES_API_KEY',
    'PILOT_PROVIDER_LIVE',
    'RESEND_API_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_GA_ID',
  ])
    env[key] = ''
  children.push(
    spawn(
      process.execPath,
      [
        path.join(root, 'node_modules/next/dist/bin/next'),
        'dev',
        '--webpack',
        '--hostname',
        '127.0.0.1',
        '--port',
        '3673',
      ],
      { cwd: site, env, windowsHide: true, stdio: ['ignore', fd, fd] },
    ),
  )
  for (let i = 0; i < 90; i++) {
    if (children.some((child) => child.exitCode !== null))
      throw Error('A local rehearsal service exited')
    try {
      const r = await fetch(origin + '/robots.txt')
      if (r.ok) break
    } catch {}
    await delay(500)
  }
  if (process.argv.includes('--scoped-analysis')) await scopedAnalysis({ origin, cron, client, session, scopedCalls })
  else if (sentiment) await sentiment.run({ origin, cron, client })
  else if (replay) await replay.run({ origin, cron, client })
  else if (volume) await benchmark({ origin, cron, client })
  else await rehearse({ origin, cron, session, service, client })
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  await close()
}
