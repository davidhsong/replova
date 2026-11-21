import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

export function sentimentReplay(file) {
  const cases = JSON.parse(readFileSync(file, 'utf8'))
  const expected = ['negative', 'negative', 'mixed', 'positive']
  assert.equal(cases.length, expected.length)
  let control = false
  let calls = 0
  return {
    response(input) {
      const i = cases.findIndex(row => row.comment === input.comment)
      assert.ok(i >= 0, 'Unexpected synthetic input')
      calls++
      return { ...cases[i].output, sentiment: control ? expected[i] : cases[i].output.sentiment }
    },
    async run({ client, origin, cron }) {
      assert.equal(origin, 'http://127.0.0.1:3673')
      const query = async (sql, args = []) => (await client.query(sql, args)).rows
      const [site] = await query("select tap_first_location(id,'Replay desk','UTC',true) id from business_workspaces limit 1")
      const [placard] = await query('insert into tap_placards(location_id) values($1) returning id',[site.id])
      await query('insert into tap_analysis_locations(location_id) values($1)', [site.id])
      for (const useExpected of [false, true]) {
        control = useExpected
        const ids = []
        for (const row of cases) {
          const [visit] = await query('select encounter from tap_open($1,false)',[placard.id])
          await query('select tap_submit($1,$2,$3,$4)',[placard.id,visit.encounter,row.rating,row.comment])
          ids.push(visit.encounter)
        }
        const tick = await fetch(origin+'/api/cron/pilot',{headers:{Authorization:'Bearer '+cron}})
        assert.equal(tick.status,200)
        const rows = await query('select id,sentiment,analysis_status,themes from tap_feedback where id=any($1)',[ids])
        const labels = ids.map((id,i) => {
          const row = rows.find(r => r.id === id)
          assert.equal(row.analysis_status,'ready')
          assert.ok(JSON.stringify(row.themes.map(t=>[t.name,t.excerpt])) ===
            JSON.stringify(cases[i].output.themes.map(t=>[t.name,t.excerpt])), 'Theme evidence changed in persistence')
          return row.sentiment
        })
        assert.deepEqual(labels,useExpected ? expected : cases.map(row=>row.output.sentiment))
        console.log(useExpected?'Expected-label control:':'Captured-output replay:',labels.join(', '))
      }
      assert.equal(calls,8)
      console.log('Eight loopback fixture calls. The worker preserved both sets of returned sentiments for identical inputs.')
    }
  }
}
