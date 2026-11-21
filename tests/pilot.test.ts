import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createDatabase } from './helpers/pilotDatabase'
import { executeRun } from '../lib/pilot/executeRun'
import { testAdapter } from '../lib/pilot/testAdapter'
import { liveAdapter, outbound, type ProviderAdapter } from '../lib/pilot/providers'
import { reviseLimits, type Book, type RunState, type Limits } from '../lib/pilot/workflow'

test('Tap transactions, private scope, quarter snapshot and worker leases', async (t) => {
  const db = await createDatabase(36)
  t.after(() => db.close())
  async function scalar(sql: string, args: unknown[] = []) {
    return Object.values((await db.query<Record<string, unknown>>(sql, args)).rows[0])[0]
  }
  const account = await scalar(
    "insert into accounts(owner_email) values ('pilot@example.invalid') returning id",
  )
  const w = await scalar(
    "insert into business_workspaces(account_id,name) values ($1,'Business') returning id",
    [account],
  )
  const first = () =>
    scalar("select tap_first_location($1,'Studio','America/Los_Angeles',true)", [w])
  const [l, again] = await Promise.all([first(), first()])
  assert.equal(l, again)
  const p = await scalar('insert into tap_placards(location_id) values ($1) returning id', [l])
  const p2 = await scalar('insert into tap_placards(location_id) values ($1) returning id', [l])
  assert.equal(await scalar('select tap_label($1)', [p]), 'Business · Studio')
  const open = (sample: boolean) => scalar('select encounter from tap_open($1,$2)', [p, sample])
  const send = (id: unknown, placard = p) =>
    scalar("select tap_submit($1,$2,2,'Insects near the door')", [placard, id])
  const one = await open(false)
  const resume = (id: unknown, placard = p) => scalar('select status from tap_resume($1,$2)', [placard,id])
  assert.equal(await resume(one),'open')
  assert.equal(await send(one, p2), 'expired')
  assert.deepEqual(await Promise.all([send(one), send(one)]), ['received', 'received'])
  assert.equal(await resume(one), 'received')
  assert.equal(await resume(one,p2), 'expired')
  await db.query('delete from tap_encounters where id=$1',[one])
  assert.equal(await resume(one), 'received')
  const expired = await open(false)
  await db.query('update tap_encounters set expires_at=now() where id=$1', [expired])
  assert.equal(await send(expired), 'expired')
  await send(await open(true))
  await send(await open(false))
  const claims = await Promise.all([
    db.query<{ id: string; lease: string }>('select id,lease from tap_claim_analysis()'),
    db.query<{ id: string; lease: string }>('select id,lease from tap_claim_analysis()'),
  ])
  assert.notEqual(claims[0].rows[0].id, claims[1].rows[0].id)
  await db.exec("update tap_feedback set analysis_status='failed',next_attempt=now()")
  assert.ok(await scalar('select lease from tap_claim_analysis()'))
  await db.exec(
    `update tap_feedback set analysis_status='ready',themes='[{"name":"Pests and hygiene","excerpt":"Insects"},{"name":"Pests and hygiene","excerpt":"door"}]'`,
  )
  const period = (await scalar('select tap_period($1,null,null,null,null,false,null,0)', [l])) as {
    total: number
    ranked: { n: number }[]
  }
  assert.equal(period.total, 2)
  assert.equal(period.ranked[0].n, 2)
  const run = await scalar('select tap_quarter($1,false,false)', [l])
  assert.ok(run)
  await db.exec("update tap_feedback set themes='[]'")
  assert.equal(await scalar('select tap_quarter($1,false,false)', [l]), run)
  const snapshot = (await scalar('select snapshot from issue_playbooks where id=$1', [
    run,
  ])) as Book['snapshot']
  assert.equal(snapshot.total, 2)
  assert.equal(snapshot.evidence.length, 2)
  assert.equal(snapshot.timezone, 'America/Los_Angeles')
  const cas = "select issue_transition($1,$2,0,'{}','{}',null)"
  assert.equal(await scalar(cas, [randomUUID(), run]), false)
  assert.deepEqual(await Promise.all([scalar(cas, [l, run]), scalar(cas, [l, run])]), [true, false])
  await db.query('update tap_placards set revoked_at=now() where id=$1', [p])
  assert.equal(await send(one), 'closed')
  await db.exec('set role authenticated')
  await assert.rejects(db.query('select * from tap_feedback'), /permission denied/)
  await assert.rejects(db.query('select tap_open($1,false)', [p]), /permission denied/)
})

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
const later = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
const limits: Limits = {
  area: 'Test area',
  scope: 'Inspect entrance',
  maxCents: 12000,
  from: tomorrow,
  until: later,
  preference: 'price',
}
function harness() {
  let book: Book = {
    id: randomUUID(),
    location_id: randomUUID(),
    theme: 'Pests and hygiene',
    is_test: true,
    revision: 0,
    quarter_start: tomorrow,
    snapshot: {
      timezone: 'UTC',
      start: tomorrow,
      endExclusive: later,
      captured: tomorrow,
      total: 2,
      evidence: [],
    },
    state: { ...reviseLimits({ kind: 'external', notes: 'Private note' }, limits).next },
  }
  const events: Record<string, unknown>[] = []
  const update = (state: RunState) => {
    book = { ...book, state, revision: book.revision + 1 }
  }
  const tick = async (adapter: ProviderAdapter = testAdapter) =>
    executeRun(
      book,
      adapter,
      async () => book,
      async (b, s, d) => {
        if (book.revision !== b.revision) return false
        update(s)
        events.push(d)
        return true
      },
    )
  return {
    get book() {
      return book
    },
    events,
    update,
    tick,
  }
}
test('research, written outreach, no eligible quote, budget rerank, booking and appointment changes', async () => {
  const h = harness()
  for (let i = 0; i < 4; i++) await h.tick()
  assert.match(h.book.state.issue!, /No eligible/)
  assert.equal(Boolean(h.book.state.appointment), false)
  const revision = reviseLimits(h.book.state, { ...limits, maxCents: 20000 })
  h.update({ ...revision.next, paused: true })
  await h.tick()
  assert.equal(Boolean(h.book.state.appointment), false)
  h.update({ ...revision.next, paused: false })
  await h.tick()
  assert.equal(h.book.state.appointment?.provider, 'A')
  assert.equal(h.events.filter((e) => e.operation === 'outreach').length, 2)
  const reference = h.book.state.appointment!.reference
  h.update(reviseLimits(h.book.state, { ...limits, maxCents: 17000 }).next)
  assert.equal(h.book.state.appointment!.reference, reference)
  h.update({ ...h.book.state, change: 'reschedule' })
  await h.tick()
  assert.notEqual(h.book.state.appointment!.reference, reference)
  h.update({ ...h.book.state, change: 'cancel' })
  await h.tick()
  assert.equal(Boolean(h.book.state.appointment), false)
})
test('uncertain outreach is reconciled while paused without sending twice or sharing private notes', async () => {
  const h = harness()
  await h.tick()
  let sends = 0,
    lookups = 0
  const uncertain: ProviderAdapter = {
    check: async () => {},
    execute: async (b, a) => {
      sends++
      assert.ok(!JSON.stringify(outbound(b, a)).includes('Private note'))
      throw Error('Lost acknowledgement')
    },
    lookup: async () => {
      lookups++
      return lookups === 1 ? 'pending' : { reference: 'test receipt', message: 'Request accepted' }
    },
  }
  await h.tick(uncertain)
  assert.ok(h.book.state.pending)
  h.update({ ...h.book.state, paused: true })
  await h.tick(uncertain)
  await h.tick(uncertain)
  await h.tick(uncertain)
  assert.equal(sends, 1)
  assert.equal(lookups, 2)
  assert.equal(h.book.state.paused, true)
  assert.deepEqual(h.book.state.contacted, ['A'])
})

test('a changed quote never becomes a confirmed appointment', async () => {
  const h = harness()
  h.update(reviseLimits(h.book.state, { ...limits, maxCents: 20000 }).next)
  for (let i = 0; i < 4; i++) await h.tick()
  await h.tick({
    ...testAdapter,
    execute: async () => ({
      changed: true,
      message: 'Provider changed the terms before accepting.',
    }),
  })
  assert.equal(h.book.state.authorized, false)
  assert.equal(h.book.state.appointment, undefined)
  assert.match(h.book.state.issue!, /terms changed/)
})

test('pause while checking capabilities prevents external dispatch', async () => {
  const h = harness()
  let dispatched = false
  await h.tick({
    ...testAdapter,
    check: async () => h.update({ ...h.book.state, paused: true }),
    execute: async () => {
      dispatched = true
      return { providers: [] }
    },
  })
  assert.equal(dispatched, false)
  assert.equal(h.book.state.paused, true)
})

test('live channel requires a selected pilot and verified capabilities, then reconciles by the original key', async (t) => {
  const book = { ...harness().book, is_test: false }
  const settings = {
    PILOT_PROVIDER_URL: 'https://gateway.example.invalid',
    PILOT_PROVIDER_TOKEN: 'test-token',
    PILOT_PROVIDER_LIVE: 'true',
    PILOT_PROVIDER_LOCATION_ID: book.location_id,
  }
  for (const [key, value] of Object.entries(settings)) {
    const original = process.env[key]
    process.env[key] = value
    t.after(() => {
      if (original === undefined) delete process.env[key]
      else process.env[key] = original
    })
  }
  let verified = false,
    calls = 0
  const key = randomUUID(),
    receipt = { reference: 'test-delivery', message: 'Written quote request accepted' }
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    calls++
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-token')
    if (url.endsWith('/capabilities'))
      return Response.json({
        verified,
        idempotency: true,
        reconciliation: true,
        conditionalBooking: true,
        operations: ['outreach'],
      })
    if (url.endsWith('/actions/' + key)) return Response.json({ status: 'confirmed', receipt })
    assert.equal(url, 'https://gateway.example.invalid/actions')
    assert.equal(new Headers(options.headers).get('Idempotency-Key'), key)
    const request = JSON.parse(String(options.body))
    assert.equal(request.scope, limits.scope)
    assert.equal(request.maxCents, undefined)
    assert.equal(request.notes, undefined)
    return Response.json(receipt)
  })
  await assert.rejects(
    liveAdapter.check('outreach', { ...book, location_id: randomUUID() }),
    /pilot location/,
  )
  assert.equal(calls, 0)
  await assert.rejects(liveAdapter.check('outreach', book), /verified support/)
  verified = true
  await liveAdapter.check('outreach', book)
  const action = { op: 'outreach' as const, key, version: 1, provider: 'verified-provider' }
  assert.deepEqual(await liveAdapter.execute(book, action), receipt)
  assert.deepEqual(await liveAdapter.lookup(book, action), receipt)
})
