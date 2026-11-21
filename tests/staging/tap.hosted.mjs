import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright-core'
import jsQR from 'jsqr'
import sharp from 'sharp'

const origin = 'https://replova-staging.vercel.app'
const env = parseEnv(readFileSync(process.env.REPLOVA_STAGING_FILE || '.env.staging.local', 'utf8'))
assert.equal(env.STAGING_INTEGRATION_TESTS, '1')
assert.equal(env.STAGING_EXPECTED_SUPABASE_PROJECT_NAME, 'replova-staging')
assert.equal(env.STAGING_EXPECTED_SUPABASE_PROJECT_REF, 'yhoblsunpmheyoqtdlvu')
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://yhoblsunpmheyoqtdlvu.supabase.co')
for (const [key, value] of Object.entries(env)) {
  if (
    /^(OPENAI_|PILOT_PROVIDER_|STRIPE_|RESEND_|GOOGLE_|YOUTUBE_|CRON_SECRET|NEXT_PUBLIC_GA_ID)/.test(
      key,
    )
  )
    assert.ok(!value, key + ' must be empty in the test environment')
}
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts)
const browser = await chromium.launch({ headless: true })
const run = randomUUID().slice(0, 8)
const accounts = [],
  sites = []
const comments = [
  'The front desk queue took twenty minutes.',
  'I waited in line at reception before anyone was free.',
]
function data(result) {
  if (result.error) throw Error('Staging operation failed ' + result.error.code)
  return result.data
}
async function context(options = {}) {
  return browser.newContext({ baseURL: origin, ...options })
}
async function ownerSession(email, baseURL = origin) {
  const link = data(await admin.auth.admin.generateLink({ type: 'magiclink', email }))
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts)
  const { session } = data(
    await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token }),
  )
  const ctx = await context({ baseURL }),
    page = await ctx.newPage()
  const login = await ctx.request.post('/api/auth/session', {
    headers: { Origin: baseURL },
    data: { accessToken: session.access_token, refreshToken: session.refresh_token },
  })
  assert.equal(login.status(), 200)
  return { email, client, ctx, page }
}
async function workspace(letter) {
  const name = 'Mobile acceptance ' + run + ' ' + letter,
    email = 'mobile-' + run + '-' + letter.toLowerCase() + '@example.invalid'
  const user = data(await admin.auth.admin.createUser({ email, email_confirm: true })).user
  accounts.push({ email, user: user.id })
  const owner = await ownerSession(email)
  const { ctx, page } = owner
  const provision = await ctx.request.post('/api/onboarding/workspace', {
    headers: { Origin: origin },
    data: { name },
  })
  assert.ok(provision.ok(), 'workspace ' + provision.status())
  await page.goto('/dashboard')
  const trial = page.getByRole('button', { name: 'Start my free trial' })
  if (await trial.isVisible()) {
    await page.getByRole('checkbox').check()
    await trial.click()
    await trial.waitFor({ state: 'hidden' })
  }
  return { ...owner, name }
}
async function issue(owner, name, zone, second = false) {
  const { ctx, page } = owner
  if (second) {
    const r = await ctx.request.post('/api/restaurants/create', {
      headers: { Origin: origin },
      data: { name, placeId: 'synthetic-' + run + '-east' },
    })
    assert.ok(r.ok(), 'second location ' + r.status())
  }
  await page.goto('/dashboard/tap')
  if (!second) {
    await page.getByLabel('Location name').fill(name)
    await page.getByLabel('Location time zone').fill(zone)
    await page.getByRole('button', { name: 'Create location' }).click()
  }
  await page.getByLabel('Placement (optional)').fill('Welcome counter')
  await page.getByLabel('Location time zone').fill(zone)
  await page.getByRole('button', { name: 'Create Tap link' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download printable QR' }).click()
  const path = await (await download).path()
  const { data: bytes, info } = await sharp(path)
    .resize(800, 800)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const url = jsQR(new Uint8ClampedArray(bytes), info.width, info.height).data
  assert.equal(url, await page.locator('.pilot-placard code').innerText())
  assert.equal(new URL(url).origin, origin)
  const placard = new URL(url).pathname.split('/').pop()
  const row = data(
    await admin.from('tap_placards').select('location_id,placement').eq('id', placard).single(),
  )
  assert.equal(row.placement, 'Welcome counter')
  const site = {
    owner,
    name,
    zone,
    id: row.location_id,
    placard,
    url,
    printable: path,
    ids: [],
    notes: [],
  }
  sites.push(site)
  return site
}
const feedback = async (id) =>
  data(
    await admin
      .from('tap_feedback')
      .select('id,location_id,is_test,comment,analysis_status,attempts,themes,created_at')
      .eq('id', id)
      .maybeSingle(),
  )
const received = /Your feedback was received/
async function visit(
  site,
  index,
  { note = '', test = false, mode = 'normal', large = false } = {},
) {
  console.log('Customer visit', site.name, index, mode, test ? 'preview' : 'published')
  const iphone = index % 2 === 0
  const ctx = await context({
    viewport: iphone ? { width: 320, height: 568 } : { width: 360, height: 640 },
    deviceScaleFactor: iphone ? 2 : 3,
    hasTouch: true,
    isMobile: true,
    javaScriptEnabled: false,
  })
  const p = await ctx.newPage(),
    cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 95000,
    uploadThroughput: 32000,
    connectionType: 'cellular3g',
  })
  if (large)
    await ctx.route('**/tap-form.css', async (route) => {
      const r = await route.fetch()
      await route.fulfill({
        response: r,
        body:
          (await r.text()) +
          '\nhtml{font-size:200%} body,textarea,button,small,p,label,legend{font-size:1rem} h1{font-size:2rem}',
      })
    })
  const url = site.url + (test ? '?test=1' : '')
  assert.equal((await p.goto(url)).status(), 200)
  assert.equal(await p.locator('script').count(), 0)
  assert.ok((await p.locator('body').innerText()).includes(site.owner.name + ' · ' + site.name))
  assert.equal((await ctx.cookies()).filter((c) => c.name.includes('auth')).length, 0)
  await p.evaluate(() => document.fonts.ready)
  assert.equal(
    await p.evaluate(() =>
      [...document.fonts].some((f) => f.family === 'Montserrat' && f.status === 'loaded'),
    ),
    true,
  )
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  for (const label of await p.locator('.ratings label').all()) {
    const box = await label.boundingBox()
    assert.ok(box.width >= 44 && box.height >= 44, 'rating touch target')
  }
  assert.equal(await p.getByRole('radio').count(), 5)
  await p.getByRole('button', { name: 'Send feedback' }).tap()
  assert.equal(await p.locator('input:invalid').count(), 5)
  let id = await p.locator('[name=encounter]').inputValue()
  const actionUrl = await p.locator('form').evaluate((form) => form.action)
  if (mode === 'interrupt') {
    const invalid = await ctx.request.post(actionUrl, {
      form: { encounter: id, rating: '8', comment: 'Validation control' },
    })
    assert.equal(invalid.status(), 422)
    assert.ok((await invalid.text()).includes(site.owner.name + ' · ' + site.name))
    assert.equal(await feedback(id), null)
  }
  const choose = async () => {
    await p
      .locator('.ratings label')
      .nth(note ? 1 : 4)
      .tap()
    const field = p.getByLabel('Comment (optional)')
    await field.focus()
    if (note) await p.keyboard.insertText(note)
    await p.keyboard.press('Tab')
    assert.equal(
      await p
        .getByRole('button', { name: 'Send feedback' })
        .evaluate((b) => b === document.activeElement),
      true,
    )
  }
  await choose()
  const button = p.getByRole('button', { name: 'Send feedback' })
  if (mode === 'expiry') {
    data(
      await admin
        .from('tap_encounters')
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('id', id)
        .eq('placard_id', site.placard),
    )
    await button.tap()
    await p.getByRole('link', { name: 'Start a fresh form' }).click()
    assert.equal(await feedback(id), null)
    id = await p.locator('[name=encounter]').inputValue()
    await choose()
  }
  if (mode === 'touchDouble') {
    await button.scrollIntoViewIfNeeded()
    const rect = await button.boundingBox()
    const touchPoints = [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }]
    for (let tap = 0; tap < 2; tap++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    }
    await p.getByRole('heading', { name: 'Thank you.' }).waitFor()
  } else if (mode === 'interrupt' || mode === 'lost' || mode === 'double') {
    let seen, release
    const seenP = new Promise((r) => {
        seen = r
      }),
      gate = new Promise((r) => {
        release = r
      })
    let raw,
      replySeen = false
    p.on('response', (r) => {
      if (r.request().method() === 'POST') replySeen = true
    })
    assert.doesNotMatch(await p.locator('body').innerText(), received)
    await ctx.route(actionUrl, async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      raw = route.request().postData()
      seen()
      await gate
      if (mode === 'double') {
        const results = await Promise.all([route.fetch(), route.fetch()])
        for (const r of results) assert.match(await r.text(), received)
        return route.fulfill({ response: results[0] })
      }
      if (mode === 'lost') {
        const r = await route.fetch()
        assert.match(await r.text(), received)
        return route.abort('connectionreset')
      }
      return route.continue()
    })
    const lost =
      mode === 'lost'
        ? p.waitForEvent('requestfailed', { predicate: (req) => req.method() === 'POST' })
        : null
    const action = button.tap({ noWaitAfter: true })
    await Promise.race([seenP, action.then(() => seenP)])
    try {
      assert.equal(replySeen, false)
      assert.equal(await feedback(id), null)
      assert.doesNotMatch(await (await ctx.request.get(actionUrl)).text(), received)
    } finally {
      release()
    }
    await action
    if (mode === 'lost') {
      await lost
      await ctx.unroute(actionUrl)
      p.on('dialog', (d) => d.accept())
      const reload = await p
        .reload({ waitUntil: 'domcontentloaded', timeout: 10000 })
        .catch(() => null)
      if (reload?.ok() && received.test(await reload.text())) {
        await p.getByRole('heading', { name: 'Thank you.' }).waitFor()
        console.log('Native browser reload recovered receipt via ' + reload.request().method())
      } else {
        await p.goto(actionUrl)
        await p.getByRole('heading', { name: 'Thank you.' }).waitFor()
        console.log('Receipt recovered by revisiting the attempted form URL')
      }
      const r = await ctx.request.post(actionUrl, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: raw,
      })
      assert.match(await r.text(), received)
    } else {
      await p.getByRole('heading', { name: 'Thank you.' }).waitFor()
    }
  } else {
    await button.tap()
    await p.getByRole('heading', { name: 'Thank you.' }).waitFor()
  }
  const row = await feedback(id)
  assert.equal(row.location_id, site.id)
  assert.equal(row.comment, note)
  assert.equal(row.is_test, test)
  if (!note) {
    assert.equal(row.analysis_status, 'ready')
    assert.equal(row.attempts, 0)
  }
  if (!test) {
    site.ids.push(id)
    if (note) site.notes.push(note)
  }
  await ctx.close()
  return id
}
async function switchTo(site, p = site.owner.page) {
  await p.goto('/dashboard/feedback')
  const select = p.getByRole('combobox', { name: 'Active location' })
  if ((await select.count()) && (await select.inputValue()) !== site.id) {
    await Promise.all([
      p.waitForResponse((r) => r.url().endsWith('/api/active-location') && r.status() === 200),
      select.selectOption(site.id),
    ])
  }
  await p.reload()
  await p.getByText(site.name + ' · ' + site.zone, { exact: true }).waitFor()
}
async function inbox(site) {
  await switchTo(site)
  const p = site.owner.page,
    label = 'Wait times · ' + site.notes.length + ' of ' + site.ids.length + ' submissions'
  const actual = data(
    await admin.from('tap_feedback').select('id').eq('location_id', site.id).eq('is_test', false),
  )
  assert.deepEqual(actual.map((r) => r.id).sort(), [...site.ids].sort())
  await p.getByRole('link', { name: label }).click()
  await p.waitForURL(
    (u) =>
      u.searchParams.get('theme') === 'Wait times' && u.searchParams.get('location') === site.id,
  )
  site.bookmark = p.url()
  assert.equal(new URL(site.bookmark).searchParams.get('location'), site.id)
  const rows = await p.locator('.pilot-row').all()
  assert.equal(rows.length, site.notes.length)
  for (const row of rows) assert.ok(site.ids.includes((await row.getAttribute('id')).slice(6)))
  for (const msg of new Set(site.notes)) assert.ok(await p.getByText(msg, { exact: true }).count())
  await p.getByRole('button', { name: 'Open Playbook for this issue' }).click()
  await p.waitForURL((u) => /\/playbooks\/[0-9a-f-]{36}$/.test(u.pathname))
  site.book = p.url()
  const b = data(
    await admin
      .from('issue_playbooks')
      .select('location_id,snapshot')
      .eq('id', new URL(site.book).pathname.split('/').pop())
      .single(),
  )
  assert.equal(b.location_id, site.id)
  assert.equal(b.snapshot.total, site.ids.length)
  assert.equal(b.snapshot.evidence.length, site.notes.length)
  console.log(site.name, label, 'QR, receipt, inbox, evidence and saved snapshot verified')
}
async function midnight(site, day, boundary) {
  const ids = []
  for (const delta of [-1000, 0]) {
    const id = await visit(site, 2, { test: true })
    ids.push(id)
    data(
      await admin
        .from('tap_feedback')
        .update({ created_at: new Date(Date.parse(boundary) + delta).toISOString() })
        .eq('id', id)
        .eq('location_id', site.id)
        .eq('is_test', true),
    )
  }
  await switchTo(site)
  const p = site.owner.page
  await p.goto('/dashboard/feedback?test=1&start=' + day + '&end=' + day)
  assert.equal(await p.locator('.pilot-row').count(), 1)
  assert.equal(await p.locator('.pilot-row').getAttribute('id'), 'entry-' + ids[1])
}
async function main() {
  const a = await workspace('A'),
    b = await workspace('B')
  const west = await issue(a, 'Cedar desk', 'America/Los_Angeles')
  const east = await issue(a, 'Elm desk', 'Asia/Tokyo', true)
  const third = await issue(b, 'Birch desk', 'America/New_York')
  assert.equal(new Set(sites.map((s) => s.url)).size, 3)
  for (const [site, total, themed] of [
    [west, 3, 2],
    [east, 4, 3],
    [third, 5, 2],
  ]) {
    for (let i = 0; i < total; i++) {
      const mode =
        site === west
          ? ['double', 'lost', 'expiry'][i]
          : site === third && i === 0
            ? 'interrupt'
            : site === east && i === 3
              ? 'touchDouble'
              : 'normal'
      await visit(site, i, { note: i < themed ? comments[i % 2] : '', mode, large: i === 2 })
    }
    await visit(site, 0, { test: true })
  }
  for (let i = 0; i < 90; i++) {
    const pending = data(
      await admin
        .from('tap_feedback')
        .select('id')
        .in(
          'location_id',
          sites.map((s) => s.id),
        )
        .neq('analysis_status', 'ready'),
    )
    if (!pending.length) break
    await sleep(2000)
  }
  for (const s of sites) await inbox(s)
  const secondSession = await ownerSession(a.email)
  try {
    await switchTo(west, a.page)
    await switchTo(east, secondSession.page)
    await Promise.all([a.page.reload(), secondSession.page.reload()])
    for (const [page, site] of [
      [a.page, west],
      [secondSession.page, east],
    ]) {
      assert.equal(await page.getByRole('combobox', { name: 'Active location' }).inputValue(), site.id)
      await page.getByText(site.name + ' · ' + site.zone, { exact: true }).waitFor()
      const rowIds = await page.locator('.pilot-row').evaluateAll((rows) => rows.map((row) => row.id))
      assert.deepEqual(rowIds.sort(), site.ids.map((id) => 'entry-' + id).sort())
    }
    console.log('PASS two independent sign-ins for owner A retained different locations and exact inbox rows')
  } finally {
    await secondSession.ctx.close()
  }
  await switchTo(east)
  await a.page.goto(west.bookmark)
  await a.page.getByRole('button', { name: 'Switch to ' + west.name }).click()
  await a.page.getByText(west.name + ' · ' + west.zone, { exact: true }).waitFor()
  await switchTo(east)
  await a.page.goto(west.book)
  await a.page.getByRole('button', { name: 'Switch to ' + west.name }).click()
  await a.page.getByRole('heading', { name: 'Wait times', exact: true }).waitFor()
  for (const url of [west.bookmark, west.book]) {
    await b.page.goto(url)
    await b.page.getByText('Error 404', { exact: true }).waitFor()
  }
  const denied = await b.ctx.request.post('/api/active-location', {
    data: { restaurantId: west.id },
  })
  assert.equal(denied.status(), 404)
  for (const [table, id] of [
    ['tap_feedback', west.ids[0]],
    ['issue_playbooks', new URL(west.book).pathname.split('/').pop()],
  ]) {
    const r = await b.client.from(table).select('id').eq('id', id)
    assert.ok(r.error?.code === '42501' || r.data?.length === 0)
  }
  await midnight(west, '2025-04-01', '2025-04-01T07:00:00Z')
  await midnight(east, '2025-04-01', '2025-03-31T15:00:00Z')
  await switchTo(east)
  await a.page.goto('/dashboard/tap')
  const old = await fetch(east.url)
  const id = (await old.text()).match(/name="encounter" value="([^"]+)"/)[1]
  await a.page.getByText('Revoke this link', { exact: true }).click()
  await a.page.getByRole('button', { name: 'Confirm revocation' }).click()
  await a.page.getByRole('link', { name: 'Download printable QR' }).waitFor({ state: 'detached' })
  assert.equal((await fetch(east.url)).status, 404)
  assert.equal(
    (
      await fetch(east.url, {
        method: 'POST',
        body: new URLSearchParams({ encounter: id, rating: '3' }),
      })
    ).status,
    404,
  )
  assert.equal(await feedback(id), null)
  for (const site of [west, third]) assert.equal((await fetch(site.url)).status, 200)
  console.log(
    'PASS mobile, retry, location bookmarks, isolation, local midnight, preview and scoped revocation',
  )
}
const runLabel = process.env.REPLOVA_ANALYSIS_RUN || ''
assert.ok(!runLabel || /^[a-z0-9-]{1,64}$/.test(runLabel), 'Invalid analysis run name')
const analysisDir = 'tmp/staging-analysis' + (runLabel ? '/' + runLabel : '')
const manifest = analysisDir + '/batch.json'
async function analysisPreflight(keep) {
  if (keep) assert.ok(!existsSync(manifest), 'Choose a fresh analysis run name')
  const owner = await workspace('Analysis'),
    site = await issue(owner, 'Model desk', 'America/Chicago')
  const novel = [
    'The line stretched across the lobby before the desk opened.',
    'Check-in took half an hour even though my appointment was scheduled.',
    'The staff were kind, but the step at the entrance blocked my wheelchair.',
    'The signs were clear and the staff made the visit easy.',
  ]
  for (const [i, note] of novel.entries()) await visit(site, i, { note })
  await visit(site, 4)
  const timeout = Date.now() + 120000
  let rows = []
  do {
    rows = data(
      await admin
        .from('tap_feedback')
        .select('id,attempts,analysis_status,themes,created_at')
        .eq('location_id', site.id),
    )
    if (rows.filter((r) => r.attempts === 1 && r.analysis_status === 'failed').length === 4) break
    await sleep(1000)
  } while (Date.now() < timeout)
  const control = rows.find((r) => r.id === site.ids[4])
  assert.equal(control.analysis_status, 'ready')
  assert.equal(control.attempts, 0)
  for (const r of rows.filter((r) => r.id !== control.id)) {
    assert.equal(r.attempts, 1)
    assert.equal(r.analysis_status, 'failed')
    assert.equal(r.themes.length, 0)
  }
  console.log(
    'Fixture preflight: scheduled worker attempted four novel comments; four rejected, zero themes. Rating-only control ready with zero attempts.',
  )
  if (keep) {
    const ids = site.ids.slice(0, 4)
    const held = data(
      await admin
        .from('tap_feedback')
        .update({ next_attempt: 'infinity' })
        .eq('location_id', site.id)
        .in('id', ids)
        .eq('analysis_status', 'failed')
        .eq('attempts', 1)
        .select('id'),
    )
    assert.equal(held.length, 4)
    mkdirSync(analysisDir, { recursive: true })
    writeFileSync(
      manifest,
      JSON.stringify(
        {
          location: site.id,
          ids,
          control: control.id,
          createdAt: rows.map((r) => [r.id, r.created_at]),
        },
        null,
        2,
      ),
      { flag: 'wx' },
    )
    // Retain only this explicitly prepared synthetic workspace for the paid acceptance run.
    accounts.splice(
      accounts.findIndex((f) => f.email === owner.email),
      1,
    )
  }
}
async function verifyAnalysis() {
  const { location, ids, control } = JSON.parse(readFileSync(manifest, 'utf8'))
  const rows = data(
    await admin
      .from('tap_feedback')
      .select('id,comment,rating,attempts,analysis_status,themes,sentiment')
      .eq('location_id', location)
      .in('id', [...ids, control]),
  )
  assert.equal(rows.length, 5)
  const comments = ids.map((id) => rows.find((row) => row.id === id))
  for (const row of comments) {
    assert.equal(row.analysis_status, 'ready')
    assert.equal(row.attempts, 2)
    for (const t of row.themes) assert.ok(t.excerpt && row.comment.includes(t.excerpt))
  }
  assert.deepEqual(
    comments.map((row) => row.sentiment),
    ['negative', 'negative', 'mixed', 'positive'],
  )
  assert.deepEqual(
    comments.map((row) => row.themes.map((theme) => theme.name)),
    [['Wait times'], ['Wait times'], ['Accessibility'], []],
  )
  const ratingOnly = rows.find((row) => row.id === control)
  assert.equal(ratingOnly.analysis_status, 'ready')
  assert.equal(ratingOnly.attempts, 0)
  assert.equal(ratingOnly.sentiment, null)
  assert.deepEqual(ratingOnly.themes, [])
  const result = data(
    await admin.rpc('tap_period', {
      p_location: location,
      p_start: null,
      p_end: null,
      p_source: null,
      p_rating: null,
      p_test: false,
      p_theme: null,
      p_page: 0,
    }),
  )
  assert.equal(result.total, 5)
  assert.equal(result.ranked.find((t) => t.theme === 'Wait times').n, 2)
  assert.equal(result.ranked.find((t) => t.theme === 'Accessibility').n, 1)
  const site = data(await admin.from('restaurants').select('owner_email').eq('id', location).single())
  assert.match(site.owner_email, /^mobile-[a-f0-9]+-analysis@example\.invalid$/)
  const revisedUI = process.argv.includes('--local-owner-ui')
  const { page, ctx } = await ownerSession(site.owner_email, revisedUI ? 'http://localhost:3928' : origin)
  try {
    const path = '/dashboard/feedback?location=' + location
    await page.setViewportSize({ width: 360, height: 640 })
    await page.goto(path)
    assert.equal(await page.locator('.pilot-row').count(), 5)
    for (const row of rows) {
      const entry = page.locator('#entry-' + row.id)
      assert.ok((await entry.locator('h3').innerText()).includes(row.rating + ' / 5'))
      const annotation = await entry.locator(':scope > small').last().innerText()
      if (row.sentiment) {
        assert.ok(annotation.includes((revisedUI ? 'Comment sentiment: ' : '') + row.sentiment))
      } else {
        assert.equal(annotation.trim(), '')
        assert.equal(await entry.locator('p').innerText(), 'Rating only')
      }
    }
    for (const [name, expected] of [['Wait times', ids.slice(0, 2)], ['Accessibility', [ids[2]]]]) {
      const bar = page.locator('a.issue-bar').getByText(name + ' · ' + expected.length + ' of 5 submissions', { exact: true })
      await bar.click()
      await page.waitForURL(url => url.searchParams.get('theme') === name)
      assert.deepEqual(
        (await page.locator('.pilot-row').evaluateAll(items => items.map(item => item.id.slice(6)))).sort(),
        [...expected].sort(),
      )
      await page.goto(path)
    }
  } finally {
    await ctx.close()
  }
  console.log(
    'Four bounded model results verified: recurring issue 2/5, access issue 1/5, praise only and rating-only controls clean.',
  )
}
try {
  if (process.argv.includes('--prepare-handset')) {
    const owner = await workspace('Handset')
    const site = await issue(owner, 'Coral desk', 'America/Los_Angeles')
    mkdirSync('tmp/staging-mobile', { recursive: true })
    writeFileSync('tmp/staging-mobile/customer-placard.svg', readFileSync(site.printable))
    console.log('Handset customer form', site.url)
    accounts.splice(
      accounts.findIndex((f) => f.email === owner.email),
      1,
    )
  } else if (process.argv.includes('--verify-analysis')) await verifyAnalysis()
  else if (process.argv.includes('--prepare-analysis')) await analysisPreflight(true)
  else if (process.argv.includes('--fixture-preflight')) await analysisPreflight(false)
  else await main()
} finally {
  await browser.close()
  for (const f of accounts) {
    const account = data(
      await admin
        .from('accounts')
        .select('id')
        .eq('owner_email', f.email)
        .eq('auth_user_id', f.user)
        .maybeSingle(),
    )
    if (account) {
      const workspaces = data(
        await admin.from('business_workspaces').select('id').eq('account_id', account.id),
      )
      for (const w of workspaces) {
        data(
          await admin
            .from('restaurants')
            .delete()
            .eq('workspace_id', w.id)
            .eq('owner_email', f.email),
        )
        data(
          await admin
            .from('business_workspaces')
            .delete()
            .eq('id', w.id)
            .eq('account_id', account.id),
        )
      }
      data(await admin.from('accounts').delete().eq('id', account.id))
    }
    data(await admin.auth.admin.deleteUser(f.user))
  }
}
