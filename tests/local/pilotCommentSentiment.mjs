import assert from 'node:assert/strict'

export function commentSentimentCheck() {
  const cases = [
    { comment: 'The repair looks wonderful.', sentiment: 'positive' },
    { comment: 'The scanner kept jamming.', sentiment: 'negative', theme: 'Equipment maintenance', excerpt: 'kept jamming' },
    { comment: 'The explanation was helpful, but the receipt listed the wrong price.', sentiment: 'mixed', theme: 'Billing', excerpt: 'wrong price' },
    { comment: 'My visit was on Tuesday afternoon.', sentiment: 'neutral' },
    { comment: 'Good morning, the confirmation never arrived. Thank you.', sentiment: 'negative', theme: 'Communication', excerpt: 'confirmation never arrived' },
  ]
  const requests = new Map(cases.map(row => [row.comment, []]))
  const themes = row => row.theme ? [{ name: row.theme, excerpt: row.excerpt }] : []
  return {
    response(body) {
      const input = JSON.parse(body.input)
      const row = cases.find(item => item.comment === input.comment)
      assert.ok(row, 'Only written fixture comments should reach the model')
      assert.deepEqual(input, { comment: row.comment })
      assert.equal(body.store, false)
      assert.equal(body.text.format.name, 'local_feedback')
      assert.equal(body.text.format.strict, true)
      requests.get(row.comment).push(body)
      return { sentiment: row.sentiment, themes: themes(row), urgent: false }
    },
    async run({ origin, cron, client }) {
      assert.equal(origin, 'http://127.0.0.1:3673')
      const sql = async (query, params = []) => (await client.query(query, params)).rows
      const [site] = await sql("select tap_first_location(id,'Sentiment desk','UTC',true) id from business_workspaces limit 1")
      const [placard] = await sql('insert into tap_placards(location_id) values($1) returning id', [site.id])
      await sql('insert into tap_analysis_locations(location_id) values($1)', [site.id])
      const visits = []
      for (const rating of [2, 5]) {
        for (const row of [...cases, { comment: '', sentiment: null }]) {
          const [visit] = await sql('select encounter from tap_open($1,false)', [placard.id])
          await sql('select tap_submit($1,$2,$3,$4)', [placard.id,visit.encounter,rating,row.comment])
          visits.push({ id: visit.encounter, rating, row })
        }
      }
      for (let i = 0; i < 3; i++) {
        const tick = await fetch(origin + '/api/cron/pilot', { headers: { Authorization: 'Bearer ' + cron } })
        assert.equal(tick.status, 200)
        const [{ remaining }] = await sql("select count(*)::int remaining from tap_feedback where location_id=$1 and analysis_status<>'ready'", [site.id])
        if (!remaining) break
      }
      const rows = await sql('select id,rating,sentiment,themes,attempts,urgent,analysis_status from tap_feedback where location_id=$1', [site.id])
      assert.equal(rows.length, visits.length)
      for (const {id,rating,row} of visits) {
        const stored = rows.find(item => item.id === id)
        assert.equal(stored.rating, rating)
        assert.equal(stored.analysis_status, 'ready')
        assert.equal(stored.sentiment, row.sentiment)
        assert.deepEqual(stored.themes, themes(row))
        assert.equal(stored.urgent, false)
        assert.equal(stored.attempts, row.comment ? 1 : 0)
      }
      for (const pair of requests.values()) {
        assert.equal(pair.length, 2)
        assert.deepEqual(pair[0], pair[1], 'The entire Responses request must be identical at both ratings')
      }
      console.log('PASS five comment types at 2/5 and 5/5: identical Responses requests; ratings, labels and exact excerpts persisted. Two rating-only visits had zero calls and null sentiment.')
    },
  }
}
