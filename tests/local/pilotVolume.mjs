import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'

const now = () => performance.now()
function percentiles(times) {
  const sorted = [...times].sort((a, b) => a - b)
  return [0.5, 0.95].map((p) => Math.round(sorted[Math.ceil(p * sorted.length) - 1] * 10) / 10)
}

export async function benchmark({ origin, cron, client }) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  assert.ok(['localhost', '127.0.0.1'].includes(client.host))
  const sql = async (q, args = []) => (await client.query(q, args)).rows
  const sites = []
  for (let business = 0; business < 20; business++) {
    const user = randomUUID(),
      email = 'volume-' + business + '@example.invalid'
    await sql('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      user,
      email,
    ])
    await sql("select * from provision_replova_account_workspace($1,$2,$3,'growth')", [
      user,
      email,
      'Volume ' + business,
    ])
    const [w] = await sql(
      'select w.id from business_workspaces w join accounts a on a.id=w.account_id where a.owner_email=$1',
      [email],
    )
    for (let i = 0; i < 3; i++) {
      const [l] = await sql(
        'insert into restaurants(owner_email,workspace_id,name,pilot_timezone,active) values($1,$2,$3,$4,true) returning id',
        [email, w.id, 'Desk ' + i, i === 0 ? 'America/Los_Angeles' : 'Asia/Tokyo'],
      )
      const [p] = await sql(
        "insert into tap_placards(location_id,placement) values($1,'Welcome counter') returning id",
        [l.id],
      )
      sites.push({ location: l.id, placard: p.id })
    }
  }
  await sql(`with sites as (select id,location_id,row_number() over(order by id)-1 as n from tap_placards)
    insert into tap_feedback(id,location_id,placard_id,rating,comment,is_test,analysis_status,created_at,themes)
    select gen_random_uuid(),s.location_id,s.id,3,'Historical wait',false,'ready',now()-((g%89)+1)*interval '1 day',
    '[{"name":"Wait times","excerpt":"wait"}]' from generate_series(1,100000) g join sites s on s.n=g%60`)
  await sql('analyze tap_feedback')
  const [hot, quiet] = sites
  if (process.argv.includes('--evidence-volume')) {
    const samples={ranking:[],drilldown:[],evidence:[],flow:[],flowVisits:[]}
    let count
    for(let i=0;i<20;i++) {
      for(const [key,query] of Object.entries({
        flow:"select tap_flow_period($1,current_date-30,current_date,null,null,false,null,0,null,null) r",
        flowVisits:"select tap_flow_period($1,current_date-30,current_date,null,null,false,null,0,null,'other') r",
        ranking:"select tap_issue_period($1,current_date-30,current_date,null,null,false,null,0) r",
        drilldown:"select tap_issue_period($1,current_date-30,current_date,null,null,false,'wait-times',0) r",
        evidence:"select count(*)::int n from tap_issue_evidence($1,current_date-30,current_date,null,null,false,'wait-times')",
      })){
        const start=now()
        const [row]=await sql(query,[hot.location])
        samples[key].push(now()-start)
        if(key==='ranking'||key==='flow')count=row.r.ranked[0].n
        else assert.equal(row.r?.matches ?? row.n,count)
      }
    }
    const [plan]=await sql("select tap_create_issue($1,current_date-30,current_date,null,null,false,'wait-times') id",[hot.location])
    const [saved]=await sql("select jsonb_array_length(snapshot->'evidence') n from issue_playbooks where id=$1",[plan.id])
    assert.equal(saved.n,count)
    await sql(`insert into tap_feedback(id,location_id,placard_id,rating,comment,is_test,analysis_status,themes)
      values(gen_random_uuid(),$1,$2,2,'Rude interaction',true,'ready','[{"name":"Staff conduct","excerpt":"Rude interaction"}]')`,[hot.location,hot.placard])
    const [preview]=await sql("select tap_create_issue($1,current_date-1,current_date+1,null,null,true,'staff-conduct') id",[hot.location])
    assert.ok(preview.id)
    assert.equal((await sql("select count(*)::int n from playbook_tasks where title like 'Staff conduct%'"))[0].n,0)
    console.log('VOLUME',JSON.stringify({businesses:20,locations:60,submissions:100000,count,msP50P95:Object.fromEntries(Object.entries(samples).map(([key,times])=>[key,percentiles(times)]))}))
    return
  }
  const url = (p) => origin + '/t/' + p
  async function open(p) {
    const res = await fetch(url(p))
    assert.equal(res.status, 200)
    return (await res.text()).match(/name="encounter" value="([^"]+)"/)[1]
  }
  async function submit(p, id, comment) {
    const res = await fetch(url(p), {
      method: 'POST',
      body: new URLSearchParams({ encounter: id, rating: '3', comment }),
    })
    assert.match(await res.text(), /Your feedback was received/)
  }
  const tick = async () => {
    const r = await fetch(origin + '/api/cron/pilot', {
      headers: { Authorization: 'Bearer ' + cron },
    })
    assert.equal(r.status, 200)
    return r.json()
  }
  await open(hot.placard)
  await tick()
  await sql('insert into tap_analysis_locations(location_id) values($1)', [hot.location])
  if (process.argv.includes('--excluded-backlog')) {
    // Make all historical visits outside the one enabled site due before the new arrival.
    const changed = await client.query("update tap_feedback set analysis_status='failed', attempts=1,next_attempt=created_at where location_id<>$1", [hot.location])
    await sql('analyze tap_feedback')
    const id = await open(hot.placard)
    await submit(hot.placard, id, 'Synthetic scoped queue check')
    await sql('begin')
    const [plan] = await sql('explain (analyze,format json) select * from tap_claim_scoped_analysis()')
    await sql('rollback')
    const start = now()
    assert.equal((await tick()).claimed, 1)
    assert.equal((await sql('select analysis_status from tap_feedback where id=$1', [id]))[0].analysis_status,'ready')
    assert.equal((await sql('select count(*)::int n from tap_feedback where location_id<>$1 and attempts<>1', [hot.location]))[0].n,0)
    console.log('SCOPED QUEUE', JSON.stringify({ locations:60, historical:100000, excludedDue:changed.rowCount,
      claimMs:plan['QUERY PLAN'][0]['Execution Time'], firstTickMs:Math.round(now()-start) }))
    return
  }
  await sql('insert into tap_analysis_locations(location_id) values($1)', [quiet.location])
  if (process.argv.includes('--stream')) {
    const arrivals = []
    for (let minute = 0; minute < 2; minute++) {
      for (let i = 0; i < 24; i++) arrivals.push({ at: minute * 60000 + i * 2400, site: hot })
      for (const at of [7000, 37000]) arrivals.push({ at: minute * 60000 + at, site: quiet })
    }
    const start = now(),
      ids = [],
      ticks = []
    let maxQuietDelay = 0
    const observed = new Set()
    const collecting = (async () => {
      for (const event of arrivals.sort((a, b) => a.at - b.at)) {
        await delay(Math.max(0, start + event.at - now()))
        const id = await open(event.site.placard)
        await submit(event.site.placard, id, 'Synthetic steady arrival')
        ids.push(id)
      }
    })()
    for (let minute = 1; minute <= 3; minute++) {
      await delay(Math.max(0, start + minute * 60000 - now()))
      await tick()
      const rows = await sql(
        `select id,location_id,analysis_status,
        extract(epoch from clock_timestamp()-created_at)::float as age
        from tap_feedback where id=any($1)`,
        [ids],
      )
      const ready = rows.filter((row) => row.analysis_status === 'ready')
      for (const row of ready) {
        if (row.location_id === quiet.location && !observed.has(row.id)) {
          observed.add(row.id)
          maxQuietDelay = Math.max(maxQuietDelay, row.age)
        }
      }
      ticks.push({
        minute,
        committed: rows.length,
        ready: ready.length,
        quietReady: observed.size,
        backlog: rows.length - ready.length,
      })
    }
    await collecting
    assert.equal(ticks.at(-1).ready, 52)
    assert.equal(observed.size, 4)
    console.log('STREAM', JSON.stringify({ ticks, maxQuietDelay }))
    return
  }
  // Hold the encounter row while the real POST is inside its database transaction.
  const held = await open(hot.placard)
  await sql('begin')
  let receipt = false
  let blockedPost
  try {
    await sql('select id from tap_encounters where id=$1 for update', [held])
    blockedPost = submit(hot.placard, held, '').then(() => {
      receipt = true
    })
    let blocked = false
    for (let i = 0; i < 100 && !blocked; i++) {
      // A new stats snapshot is required inside this transaction.
      await sql('select pg_stat_clear_snapshot()')
      blocked = (
        await sql(
          "select exists(select 1 from pg_stat_activity where wait_event_type='Lock' and query ilike '%tap_submit%') blocked",
        )
      )[0].blocked
      if (!blocked) await delay(25)
    }
    assert.ok(blocked, 'POST reached the database row lock')
    assert.equal(receipt, false)
    assert.equal((await sql('select id from tap_feedback where id=$1', [held])).length, 0)
  } finally {
    await sql('commit')
  }
  await blockedPost
  assert.equal((await sql('select id from tap_feedback where id=$1', [held])).length, 1)
  const opens = [],
    posts = [],
    ids = []
  for (const [site, n] of [
    [hot, 40],
    [quiet, 4],
  ]) {
    for (let base = 0; base < n; base += 4) {
      await Promise.all(
        Array.from({ length: Math.min(4, n - base) }, async (_, j) => {
          const t = now(),
            id = await open(site.placard)
          opens.push(now() - t)
          ids.push(id)
          const start = now()
          await submit(site.placard, id, 'Synthetic ' + site.location + ' visit ' + (base + j))
          posts.push(now() - start)
          if (j === 0) await submit(site.placard, id, 'Duplicate retry')
        }),
      )
    }
  }
  assert.equal(
    (await sql('select count(*)::int as n from tap_feedback where id=any($1)', [ids]))[0].n,
    44,
  )
  const queryTimes = {}
  async function period(site, page, theme = null, start = null, end = null) {
    return (
      await sql('select tap_issue_period($1,$2,$3,null,null,false,$4,$5) as result', [
        site.location,
        start,
        end,
        theme,
        page,
      ])
    )[0].result
  }
  for (const theme of [null, 'Wait times']) {
    const times = []
    for (let i = 0; i < 20; i++) {
      const t = now()
      const r = await period(hot, i % 2, theme)
      times.push(now() - t)
      assert.equal(r.rows.length, 25)
    }
    queryTimes[theme ? 'themeFiltered' : 'inboxAndChart'] = percentiles(times)
  }
  const evidenceTimes=[]
  for(let i=0;i<10;i++){
    const t=now()
    const [result]=await sql("select count(*)::int n from tap_issue_evidence($1,null,null,null,null,false,'wait-times')",[hot.location])
    assert.equal(result.n,(await period(hot,0,'Wait times')).matches)
    evidenceTimes.push(now()-t)
  }
  queryTimes.evidenceAndDrilldown=percentiles(evidenceTimes)
  const first = await period(hot, 0),
    second = await period(hot, 1)
  assert.equal(new Set([...first.rows, ...second.rows].map((r) => r.id)).size, 50)
  // Captured before queue processing to expose the planner's choice on a live backlog.
  const fair = (
    await sql(
      "select exists(select 1 from information_schema.columns where table_name='restaurants' and column_name='tap_last_claimed_at') enabled",
    )
  )[0].enabled
  const fairPlan = `select l.id from restaurants l join (select location_id,min(next_attempt) oldest
    from tap_feedback where analysis_status<>'ready' and attempts<6 and next_attempt<=now() group by location_id)
    due on due.location_id=l.id order by l.tap_last_claimed_at nulls first,due.oldest,l.id
    limit 1 for no key update of l skip locked`
  for (const [label, q, params] of [
    [
      'inbox',
      "select id from tap_feedback where location_id=$1 and created_at>=now()-interval '30 days' order by created_at desc,id limit 25",
      [hot.location],
    ],
    [
      'theme',
      "select t->>'name',count(distinct f.id) from tap_feedback f cross join lateral jsonb_array_elements(f.themes) t where location_id=$1 and created_at>=now()-interval '30 days' group by 1",
      [hot.location],
    ],
    ['cleanup', "select id from tap_encounters where expires_at<now()-interval '1 day'", []],
    [
      'claim',
      "select id from tap_feedback where analysis_status<>'ready' and attempts<6 and next_attempt<=now() order by next_attempt,id limit 1 for update skip locked",
      [],
    ],
    ...(fair
      ? [
          ['fairLocation', fairPlan, []],
          [
            'fairClaim',
            "select id from tap_feedback where location_id=$1 and analysis_status<>'ready' and attempts<6 and next_attempt<=now() order by next_attempt,id limit 1 for update skip locked",
            [hot.location],
          ],
        ]
      : []),
  ]) {
    const plan = await sql('explain (analyze,buffers) ' + q, params)
    console.log(label, plan.map((r) => r['QUERY PLAN']).join('\n'))
  }
  // EXPLAIN on a scalar SQL function can hide its body behind a Result node.
  // Plan the installed RPC body with the identical parameters as a separate check.
  const [rpc] = await sql("select prosrc from pg_proc where oid='public.tap_issue_period(uuid,date,date,uuid,integer,boolean,text,integer,uuid)'::regprocedure")
  const args = ['p_location','p_start','p_end','p_source','p_rating','p_test','p_theme','p_page','p_entry']
  const types = ['uuid','date','date','uuid','integer','boolean','text','integer','uuid']
  const body = rpc.prosrc.replace(/\bp_\w+\b/g, name => {
    const i=args.indexOf(name)
    assert.ok(i>=0)
    return '$'+(i+1)+'::'+types[i]
  })
  const today=new Date().toISOString().slice(0,10), from=new Date(Date.now()-29*86400000).toISOString().slice(0,10)
  for(const theme of [null,'Wait times']){
    const plan=await sql('explain (analyze,buffers) '+body,[hot.location,from,today,null,null,false,theme,0,null])
    console.log(theme?'rpcTheme':'rpcInbox',plan.map(r=>r['QUERY PLAN']).join('\n'))
  }
  const cadence = process.argv.includes('--minute-cadence') ? 60000 : 0
  let quietTick = 0,
    quietMs = 0,
    peakAge = 0
  const ticks = [],
    start = now()
  for (let i = 1; i <= 20; i++) {
    if (cadence) await delay(Math.max(0, start + (i - 1) * cadence - now()))
    const [before] = await sql(
      "select coalesce(max(extract(epoch from now()-created_at)),0)::float age from tap_feedback where id=any($1) and analysis_status<>'ready'",
      [ids],
    )
    peakAge = Math.max(peakAge, before.age)
    const t = now()
    await tick()
    const [progress] = await sql(
      `select count(*) filter(where analysis_status='ready')::int as done,
      count(*) filter(where location_id=$2 and analysis_status='ready')::int as quiet,
      count(*) filter(where attempts=0)::int as pending,
      coalesce(max(extract(epoch from now()-created_at)) filter(where attempts=0),0)::float as age
      from tap_feedback where id=any($1)`,
      [ids, quiet.location],
    )
    ticks.push({ i, ms: Math.round(now() - t), ...progress })
    peakAge = Math.max(peakAge, progress.age)
    if (!quietTick && progress.quiet) {
      quietTick = i
      quietMs = Math.round(now() - start)
    }
    if (cadence ? progress.done === 44 : !progress.pending) break
  }
  assert.ok(quietTick)
  // Advance only retry eligibility, avoiding a real two-minute sleep in the disposable database.
  await sql(
    "update tap_feedback set next_attempt=now() where analysis_status='failed' and id=any($1)",
    [ids],
  )
  await tick()
  assert.equal(
    (
      await sql(
        "select count(*)::int n from tap_feedback where id=any($1) and analysis_status='ready'",
        [ids],
      )
    )[0].n,
    44,
  )
  const id = ids[0]
  await sql(
    "update tap_feedback set attempts=0,analysis_status='pending',next_attempt=now() where id=$1",
    [id],
  )
  const [claim] = await sql('select * from tap_claim_scoped_analysis()')
  assert.equal(claim.id, id)
  await sql("update tap_feedback set next_attempt=now()-interval '1 second' where id=$1", [id])
  await tick()
  assert.equal(
    (await sql('select analysis_status from tap_feedback where id=$1', [id]))[0].analysis_status,
    'ready',
  )
  await sql(
    "insert into tap_encounters(placard_id,is_test,expires_at) values($1,true,now()-interval '2 days')",
    [hot.placard],
  )
  const close = await fetch(origin + '/api/cron/pilot-quarter', {
    headers: { Authorization: 'Bearer ' + cron },
  })
  assert.equal(close.status, 200)
  assert.equal(
    (
      await sql(
        "select count(*)::int n from tap_encounters where expires_at<now()-interval '1 day'",
      )
    )[0].n,
    0,
  )
  // A dedicated historical boundary with two visits on either side of midnight in Los Angeles.
  const site = sites[3]
  for (const ts of [
    '2025-04-01T06:59:59Z',
    '2025-04-01T06:59:59.5Z',
    '2025-04-01T07:00:00Z',
    '2025-04-01T07:00:01Z',
  ]) {
    await sql(
      `insert into tap_feedback(id,placard_id,location_id,rating,comment,is_test,analysis_status,created_at,themes)
      values(gen_random_uuid(),$1,$2,2,'boundary wait',false,'ready',$3,'[{"name":"Boundary","excerpt":"wait"}]')`,
      [site.placard, site.location, ts],
    )
  }
  for (const day of ['2025-03-31', '2025-04-01']) {
    assert.equal((await period(site, 0, 'Boundary', day, day)).matches, 2)
    const [b] = await sql("select tap_quarter($1,false,false,'Boundary',$2) id", [
      site.location,
      day,
    ])
    const [snapshot] = await sql('select snapshot from issue_playbooks where id=$1', [b.id])
    assert.equal(snapshot.snapshot.evidence.length, 2)
  }
  console.log(
    'VOLUME',
    JSON.stringify({
      historical: 100000,
      locations: 60,
      cadence,
      openMs: percentiles(opens),
      submitMs: percentiles(posts),
      queryMs: queryTimes,
      ticks,
      quietTick,
      quietMs,
      peakAge,
      committed: 44,
      duplicateOrLost: 0,
    }),
  )
}
