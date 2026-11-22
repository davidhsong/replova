import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createDatabase } from './helpers/pilotDatabase'
import { flowCounts } from '../lib/pilot/flow'

test('feedback flow conserves distinct visits across branches, filters and owner corrections', async () => {
  const db = await createDatabase(40)
  const id = '7170de00-69ce-4280-854c-ba19c7325401'
  const visit = (n: number) => '7170de00-69ce-4280-854c-ba19c732560' + n
  try {
    const fixture = await readFile('tests/sql/feedbackFlowDemo.sql', 'utf8')
    await db.exec(fixture)
    await db.exec(
      fixture.replaceAll('7170de00', '8270de00').replaceAll('flow-review@', 'second-flow@'),
    )
    async function result(
      key: string | null,
      start = '2026-11-01',
      end = '2026-11-30',
      theme: string | null = null,
      preview = false,
      loc = id,
    ) {
      const query = await db.query<{
        r: { leaves: Parameters<typeof flowCounts>[0]; rows: { id: string }[]; matches: number }
      }>('select tap_flow_period($1,$2,$3,null,null,$4,$5,0,null,$6) r', [
        loc,
        start,
        end,
        preview,
        theme,
        key,
      ])
      return query.rows[0].r
    }
    for (const [key, ids] of Object.entries({
      total: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      written: [1, 2, 3, 4, 5, 6, 8, 9],
      rating: [7],
      issue: [1, 2, 3, 4, 5, 6],
      clear: [8, 9],
      urgent: [1, 2],
      other: [3, 4, 5, 6],
    })) {
      const r = await result(key)
      assert.deepEqual(r.rows.map((row) => row.id).sort(), ids.map(visit))
      assert.equal(r.matches, ids.length)
      assert.equal(flowCounts(r.leaves)[key as keyof ReturnType<typeof flowCounts>], ids.length)
    }
    assert.equal((await result('urgent', undefined, undefined, 'product-quality')).matches, 1)
    assert.equal((await result('total', undefined, undefined, null, true)).matches, 0)
    const second = await result(
      'urgent',
      undefined,
      undefined,
      null,
      false,
      id.replace('7170', '8270'),
    )
    assert.deepEqual(
      second.rows.map((row) => row.id).sort(),
      [1, 2].map((n) => visit(n).replace('7170', '8270')),
    )
    await db.query("update tap_feedback set themes='[]' where id in ($1,$2)", [visit(1), visit(6)])
    assert.equal((await result('urgent')).matches, 2) // urgent flag survives theme removal
    assert.equal((await result('clear')).matches, 3)
    await db.query(
      "update tap_feedback set analysis_status='pending',created_at='2026-11-01 06:59:59Z' where id=$1",
      [visit(9)],
    )
    await db.query(
      "update tap_feedback set analysis_status='failed',created_at='2026-11-01 07:00Z' where id=$1",
      [visit(8)],
    )
    assert.equal((await result('unavailable', '2026-11-01', '2026-11-01')).matches, 1)
    assert.equal((await result('clear', '2026-11-01', '2026-11-01')).matches, 0)
    await db.query(
      "insert into tap_analysis_locations(location_id,enabled_from) values($1,'2026-10-01')",
      [id],
    )
    assert.equal((await result('pending', '2026-10-31', '2026-11-01')).matches, 1)
    await db.query('update tap_analysis_locations set remaining_claims=0 where location_id=$1', [
      id,
    ])
    assert.equal((await result('unavailable', '2026-10-31', '2026-11-01')).matches, 2)
    assert.equal(flowCounts((await result(null, '2025-01-01', '2025-01-01')).leaves).total, 0)
  } finally {
    await db.close()
  }
})
