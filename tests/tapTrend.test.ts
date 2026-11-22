import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createDatabase } from './helpers/pilotDatabase'
import { seedTrend } from './helpers/tapTrendFixture.mjs'

test('automatic Tap follow-up uses real completion, scoped visits and the existing evidence thresholds', async (t) => {
  const db = await createDatabase(39)
  t.after(() => db.close())
  const sql = async (query: string, args: unknown[] = []) =>
    (await db.query<Record<string, string>>(query, args)).rows
  const [{ id: account }] = await sql(
    "insert into accounts(owner_email) values('trend@example.invalid') returning id",
  )
  const [{ id: workspace }] = await sql(
    "insert into business_workspaces(account_id,name) values($1,'Trend fixture') returning id",
    [account],
  )
  const [{ id: loc }] = await sql(
    "select tap_first_location($1,'Cedar Studio','America/Los_Angeles',true) id",
    [workspace],
  )
  const { id, source, task } = await seedTrend(sql, loc)
  type Result = {
    status: string
    completedAt: string | null
    matches: number
    total: number
    baselineMatches: number
    baselineTotal: number
    pending: number
    start: string
    baselineEnd: string
  }
  const trend = async (run = id, location = loc) =>
    (await db.query<{ r: Result }>('select tap_feedback_trend($1,$2) r', [location, run])).rows[0].r
  const first = await trend()
  assert.equal(first.status, 'less')
  assert.equal(first.start, first.completedAt)
  assert.ok(Date.parse(first.start) > Date.parse(first.baselineEnd))
  assert.deepEqual(
    [first.baselineMatches, first.baselineTotal, first.matches, first.total],
    [3, 5, 1, 6],
  )
  assert.equal(await trend(id, randomUUID()), null)
  assert.equal(
    (await sql('select owner_verification from issue_playbooks where id=$1', [id]))[0]
      .owner_verification,
    null,
  )

  async function scenario(fn: () => Promise<void>) {
    await db.exec('begin')
    try {
      await fn()
    } finally {
      await db.exec('rollback')
    }
  }
  await sql(
    "update playbook_tasks set status='done',completed_at=now(),description='Edited after completion' where id=$1",
    [task],
  )
  assert.equal((await trend()).completedAt, first.completedAt)
  await scenario(async () => {
    await sql("update playbook_tasks set status='todo',completed_at=null where id=$1", [task])
    await sql(
      "update playbook_tasks set status='done',completed_at=now()-interval '6 days' where id=$1",
      [task],
    )
    assert.equal((await trend()).status, 'waiting')
  })
  await scenario(async () => {
    await sql(
      "update tap_feedback set analysis_status='pending' where id=(select id from tap_feedback where placard_id=$1 and not is_test and rating=3 order by created_at desc limit 1)",
      [source],
    )
    assert.equal((await trend()).pending, 1)
    assert.equal((await trend()).status, 'waiting')
  })
  await scenario(async () => {
    await sql(
      "delete from tap_feedback where placard_id=$1 and created_at>now()-interval '7 days'",
      [source],
    )
    assert.equal((await trend()).total, 0)
    assert.equal((await trend()).status, 'waiting')
  })
  await scenario(async () => {
    await sql("update issue_playbooks set snapshot=jsonb_set(snapshot,'{total}','4') where id=$1", [
      id,
    ])
    assert.equal((await trend()).status, 'waiting')
  })
  await scenario(async () => {
    await sql(
      "update issue_playbooks set snapshot=jsonb_set(snapshot,'{total}','18') where id=$1",
      [id],
    )
    assert.equal((await trend()).status, 'no_decrease') // 3/18 equals 1/6
    await sql(
      "update issue_playbooks set snapshot=jsonb_set(snapshot,'{total}','19') where id=$1",
      [id],
    )
    assert.equal((await trend()).status, 'no_decrease')
  })
  await scenario(async () => {
    await sql(
      'update issue_playbooks set state=state||\'{"route":"facilities","stage":"completed","appointment":{"reference":"SIM-local"}}\' where id=$1',
      [id],
    )
    const result = await trend()
    assert.equal(result.completedAt, null)
    assert.deepEqual([result.matches, result.total], [4, 9])
  })
  await scenario(async () => {
    await sql(
      `update tap_feedback set urgent=true,themes=themes||'[{"name":"Safety","excerpt":"Rude interaction"}]'::jsonb
      where placard_id=$1 and themes<>'[]' and created_at < now()-interval '18 days'`,
      [source],
    )
    const [{ id: safety }] = await sql(
      "select tap_create_issue($1,current_date-24,current_date-18,$2,3,false,'safety') id",
      [loc, source],
    )
    await sql(
      `update issue_playbooks set created_at=now()-interval '16 days',
      snapshot=jsonb_set(snapshot,'{captured}',to_jsonb(now()-interval '16 days')),
      owner_verification='{"note":"Owner confirmation already on file"}' where id=$1`,
      [safety],
    )
    const history = () =>
      sql('select state,owner_context,owner_verification from issue_playbooks where id=$1', [
        safety,
      ])
    const before = await history()
    const result = await trend(safety)
    assert.equal(result.status, 'less')
    assert.deepEqual([result.baselineMatches, result.matches], [3, 0])
    assert.deepEqual(await history(), before)
    assert.equal(
      (await sql("select state->>'stage' stage from issue_playbooks where id=$1", [safety]))[0]
        .stage,
      'owner',
    )
    assert.equal(
      (await sql('select id from tap_feedback where urgent and placard_id=$1', [source])).length,
      3,
    )
  })
  await scenario(async () => {
    await sql(
      'update issue_playbooks set category_id=null,theme=\'Staff conduct\',state=\'{"kind":"internal","internalDone":true}\' where id=$1',
      [id],
    )
    await sql(
      'insert into issue_activity(run_id,revision,detail,created_at) values($1,1,\'{"action":"task"}\',now()-interval \'8 days\')',
      [id],
    )
    const result = await trend()
    assert.equal(result.start, result.completedAt)
    assert.deepEqual([result.baselineMatches, result.baselineTotal, result.total], [3, 5, 6])
  })
  assert.equal((await sql("select tap_verify_issue($1,$2,'') ok", [loc, id]))[0].ok, true)
  assert.equal(
    (await sql("select tap_verify_issue($1,$2,'replacement') ok", [loc, id]))[0].ok,
    false,
  )
  await db.exec('set role authenticated')
  await assert.rejects(trend(), /permission denied/i)
})
