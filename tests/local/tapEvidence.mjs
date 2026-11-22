import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { seedTrend } from '../helpers/tapTrendFixture.mjs'
import { chromium } from 'playwright-core'

export async function evidenceRehearsal({
  origin,
  cron,
  client,
  session,
  secondSession,
  newClient,
  scopedCalls,
  blockedFile,
}) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const sql = async (q, args = []) => (await client.query(q, args)).rows
  const fixture = [
    [
      'The drink was stale. I felt ill after drinking it.',
      true,
      [
        ['Food safety', 'I felt ill after drinking it.'],
        ['Product quality', 'The drink was stale.'],
      ],
    ],
    [
      'I felt sick after my order.',
      true,
      [['Food and drink safety', 'I felt sick after my order.']],
    ],
    [
      'There was an odor and dirt near the entrance.',
      false,
      [
        ['Odor', 'an odor'],
        ['Cleanliness', 'dirt near the entrance'],
      ],
    ],
    ['Dust on the counter.', false, [['Cleanliness', 'Dust on the counter.']]],
    ['The drink was watered down.', false, [['Food and drink quality', 'watered down']]],
    ['The employee was rude.', false, [['Staff behavior', 'The employee was rude.']]],
    ['', false, []],
    ['Wonderful service.', false, []],
    ['', false, []],
  ]
  const expected = {
    safety: [0, 1],
    cleanliness: [2, 3],
    'product-quality': [0, 4],
    'staff-conduct': [5],
  }
  async function site(email, name, zone) {
    const [l] = await sql(
      'insert into restaurants(workspace_id,owner_email,name,pilot_timezone,active) select w.id,a.owner_email,$2,$3,true from business_workspaces w join accounts a on a.id=w.account_id where a.owner_email=$1 returning id',
      [email, name, zone],
    )
    const [p] = await sql(
      "insert into tap_placards(location_id,placement) values($1,'Welcome counter') returning id",
      [l.id],
    )
    await sql('insert into tap_analysis_locations(location_id,remaining_claims) values($1,8)', [
      l.id,
    ])
    const site = { id: l.id, placard: p.id, visits: [] }
    for (const [comment, urgent, labels] of fixture)
      site.visits.push(await visit(site, comment, urgent, labels))
    await visit(site, 'Preview odor', false, [['Odor', 'odor']], true)
    return site
  }
  async function visit(site, comment, urgent, labels, preview = false) {
    const id = randomUUID()
    await sql(
      "insert into tap_feedback(id,location_id,placard_id,rating,comment,urgent,themes,is_test,analysis_status) values($1,$2,$3,$4,$5,$6,$7,$8,'ready')",
      [
        id,
        site.id,
        site.placard,
        labels.length ? 2 : 5,
        comment,
        urgent,
        JSON.stringify(labels.map(([name, excerpt]) => ({ name, excerpt }))),
        preview,
      ],
    )
    return id
  }
  const sites = [
    await site(session.user.email, 'Cedar Studio', 'America/Los_Angeles'),
    await site(session.user.email, 'Maple Studio', 'Asia/Tokyo'),
    await site(secondSession.user.email, 'Birch Workshop', 'America/New_York'),
  ]
  async function period(site, category) {
    return (
      await sql('select tap_issue_period($1,null,null,null,null,false,$2,0) r', [site.id, category])
    )[0].r
  }
  async function create(site, category) {
    return (
      await sql(
        'select tap_create_issue($1,current_date-29,current_date+1,null,null,false,$2) id',
        [site.id, category],
      )
    )[0].id
  }
  for (const site of sites) {
    for (const [category, indices] of Object.entries(expected)) {
      const r = await period(site, category)
      assert.equal(r.total, 9)
      assert.equal(r.matches, indices.length)
      assert.equal(r.ranked.find((t) => t.category === category).n, indices.length)
      assert.deepEqual(r.rows.map((v) => v.id).sort(), indices.map((i) => site.visits[i]).sort())
    }
    assert.equal((await period(site, null)).rows.filter((r) => r.urgent).length, 2)
  }
  console.log(
    'Each of three locations: Safety 2/9 (2 opened), Cleanliness & environment 2/9 (2), Product quality 2/9 (2), Staff conduct 1/9 (1); two urgent.',
  )
  const [a, m, b] = sites
  for (const alias of ['Odor', 'Cleanliness']) {
    const [old] = await sql('select tap_quarter($1,false,false,$2) id', [a.id, alias])
    if (!old.id)
      await sql(
        "insert into issue_playbooks(location_id,quarter_start,theme,focus,snapshot) values($1,date_trunc('quarter',now()),$2,$2,$3)",
        [
          a.id,
          alias,
          JSON.stringify({
            start: '2026-01-01',
            timezone: 'UTC',
            captured: new Date().toISOString(),
            total: 9,
            evidence: [],
          }),
        ],
      )
  }
  assert.equal((await period(a, 'Odor')).related.length, 2)
  async function independentCreate() {
    const connection = newClient()
    await connection.connect()
    try {
      return (
        await connection.query(
          "select tap_create_issue($1,current_date-29,current_date+1,null,null,false,'staff-conduct') id",
          [a.id],
        )
      ).rows[0].id
    } finally {
      await connection.end()
    }
  }
  const [staff1, staff2] = await Promise.all([independentCreate(), independentCreate()])
  assert.equal(staff1, staff2)
  assert.equal(
    (await sql("select count(*)::int n from playbook_tasks where title like 'Staff conduct%'"))[0]
      .n,
    1,
  )
  const safety = await create(a, 'safety')
  const otherPlan = await create(b, 'cleanliness')
  assert.equal(
    (await sql("select issue_transition($1,$2,0,'{}','{}',now()) as ok", [b.id, otherPlan]))[0].ok,
    false,
  )
  const [initial] = await sql('select state,snapshot from issue_playbooks where id=$1', [otherPlan])
  assert.equal(initial.snapshot.evidence.length, 2)
  assert.equal(initial.state.stage, 'discovery')
  const { simulationStep } = await import('../../lib/pilot/issueSimulation.ts')
  const firstStep = simulationStep(otherPlan, initial.state)
  const record = await sql('select tap_simulation_transition($1,$2,0,$3,$4) ok', [
    b.id,
    otherPlan,
    firstStep.state,
    { status: firstStep.status, summary: firstStep.summary, stage: 'discovery' },
  ])
  assert.equal(record[0].ok, true)
  // Discard all in-memory simulation state; the normal minute worker picks up revision one.
  const tick = () =>
    fetch(origin + '/api/cron/pilot', { headers: { Authorization: 'Bearer ' + cron } }).then(
      async (r) => {
        assert.equal(r.status, 200)
        assert.equal((await r.json()).claimed, 0)
      },
    )
  await Promise.all([tick(), tick()])
  const history = async (id) =>
    (
      await sql(
        'select revision,state,snapshot,owner_context,added_evidence from issue_playbooks where id=$1',
        [id],
      )
    )[0]
  assert.equal((await history(otherPlan)).state.stage, 'completed')
  assert.equal((await history(safety)).state.stage, 'owner')
  const browser = await chromium.launch()
  const blockedBrowser = []
  async function context(who, width, video = false) {
    const dir = mkdtempSync(path.join(tmpdir(), 'tap-video-'))
    const c = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
      ...(video ? { recordVideo: { dir, size: { width, height: 844 } } } : {}),
    })
    await c.route('**/*', (route) => {
      if (new URL(route.request().url()).origin !== origin) {
        blockedBrowser.push(route.request().url())
        return route.abort()
      }
      return route.continue()
    })
    await c.addCookies([
      {
        name: 'sb-127-auth-token',
        value: 'base64-' + Buffer.from(JSON.stringify(who)).toString('base64url'),
        url: origin,
      },
    ])
    return c
  }
  const second = await context(secondSession, 1280)
  const denied = await second.newPage()
  try {
    const select = async (c, site) =>
      assert.equal(
        (
          await c.request.post(origin + '/api/active-location', { data: { restaurantId: site.id } })
        ).status(),
        200,
      )
    for (const [site, width] of [
      [a, 1280],
      [m, 390],
    ]) {
      const c = await context(session, width, width === 390)
      await select(c, site)
      const p = await c.newPage()
      p.setDefaultTimeout(60000)
      try {
        await p.goto(origin + '/dashboard/feedback', { waitUntil: 'domcontentloaded' })
        const row = p.getByRole('link', { name: /Cleanliness & environment · 2 of 9/ })
        await row.scrollIntoViewIfNeeded()
        if (width === 390) await p.waitForTimeout(650)
        await row.click()
        await p.getByText('2 matching submissions', { exact: false }).waitFor()
        assert.equal(await p.locator('.pilot-row').count(), 2)
        if (width === 390) await p.waitForTimeout(800)
        const request = p.waitForRequest(
          (r) => r.method() === 'POST' && r.url().includes('/dashboard/feedback'),
        )
        await p.getByRole('button', { name: 'Create Playbook' }).click()
        const creating = await request
        await p.waitForURL('**/dashboard/playbooks/*')
        const id = new URL(p.url()).pathname.split('/').pop()
        if (width === 1280) {
          const forged = await second.request.post(creating.url(), {
            headers: {
              'next-action': creating.headers()['next-action'],
              'content-type': creating.headers()['content-type'],
              origin,
            },
            data: creating.postDataBuffer(),
            maxRedirects: 0,
          })
          assert.ok([200, 404].includes(forged.status()))
          assert.match(await forged.text(), /404|NEXT_HTTP_ERROR_FALLBACK/)
        }
        await p.getByText('View details · Original evidence', { exact: true }).click()
        assert.equal(await p.getByRole('link', { name: 'Open source submission' }).count(), 2)
        await p.getByText('dirt near the entrance', { exact: true }).waitFor()
        await p.getByText('View details · Original evidence', { exact: true }).click()
        await tick()
        await p.reload()
        for (const title of [
          'Simulation · Quote decision',
          'Simulation · Appointment',
          'Simulation · Simulated service completed',
          'Feedback comparison',
        ]) {
          const summary = p.locator('summary').filter({ hasText: 'View details · ' + title })
          await summary.click()
          if (title.includes('Quote decision')) {
            await p
              .locator('strong')
              .filter({ hasText: 'Selected for the lowest qualifying' })
              .waitFor()
            await p.getByText('Exceeds the simulated service budget.').waitFor()
          }
          if (width === 390) await p.waitForTimeout(1000)
          await summary.click()
        }
        assert.ok(await p.getByText('Awaiting more feedback', { exact: true }).count())
        assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        console.log(
          'Inspected evidence, written terms, appointment and verification at ' + width + 'px',
        )
        const saved = await history(id)
        assert.equal(saved.snapshot.evidence.length, 2)
        assert.equal(saved.state.appointment.reference, 'SIM-' + id)
        const logCount = await sql('select count(*)::int n from issue_activity where run_id=$1', [
          id,
        ])
        assert.equal(logCount[0].n, 6)
        await tick()
        assert.equal((await history(id)).revision, saved.revision)
        if (width === 1280) {
          await p.getByText('Owner context', { exact: true }).click()
          await p
            .getByLabel('Incident details or corrective work')
            .fill('Team inspected the entry.')
          await p.getByRole('button', { name: 'Save context' }).click()
          await p.getByText('Owner context · Saved').waitFor()
          await visit(site, 'Another odor at entry', false, [['Odor', 'odor']])
          await p.reload()
          await p.getByText('View details · New supporting visits (1)').click()
          await p.getByRole('button', { name: 'Add new evidence to plan' }).click()
          await p.getByText('View details · Added evidence (1)').waitFor()
          const updated = await history(id)
          assert.equal(updated.added_evidence.length, 1)
          assert.equal(updated.owner_context, 'Team inspected the entry.')
          assert.deepEqual(updated.snapshot, saved.snapshot)
          await p.goto(origin + '/dashboard/feedback?theme=Odor')
          await p.getByRole('link', { name: 'Open Playbook', exact: true }).click()
          await p.waitForURL((u) => u.pathname === '/dashboard/playbooks/' + id)
          assert.equal(new URL(p.url()).pathname.split('/').pop(), id)
          await denied.goto(p.url())
          assert.doesNotMatch(
            await denied.locator('body').innerText(),
            /Team inspected|Sample Facilities|SIM-|dirt near/,
          )
          await denied.goto(origin + '/dashboard/feedback?location=' + site.id)
          assert.doesNotMatch(
            await denied.locator('body').innerText(),
            /dust on the counter|Team inspected/i,
          )
          await p.goto(origin + '/dashboard/feedback?theme=staff-conduct')
          await p.getByText('Correct themes', { exact: true }).click()
          await p
            .getByLabel('Themes, separated by commas')
            .fill('Accessibility, Unfamiliar fixture detail')
          await p.getByRole('button', { name: 'Save correction' }).click()
          await p.getByText('0 matching submissions', { exact: false }).waitFor()
          assert.equal((await period(site, 'accessibility')).matches, 1)
          assert.equal((await period(site, 'other:unfamiliar fixture detail')).matches, 1)
          assert.equal((await history(staff1)).snapshot.evidence.length, 1)
        }
      } finally {
        const video = p.video()
        await c.close()
        if (video && process.env.TAP_EVIDENCE_VIDEO) {
          mkdirSync(path.dirname(process.env.TAP_EVIDENCE_VIDEO), { recursive: true })
          await video.saveAs(process.env.TAP_EVIDENCE_VIDEO)
        }
      }
    }
    // Open an aged, completed task on a phone. No owner form or worker tick advances the comparison.
    const example = await seedTrend(sql, m.id)
    const phone = await context(session, 390)
    try {
      await select(phone, m)
      const page = await phone.newPage()
      await page.goto(origin + '/dashboard/playbooks/' + example.id)
      const panel = page.getByRole('region', { name: 'Playbook follow-up' })
      await panel.getByText('Reported less often', { exact: true }).waitFor()
      assert.match(await panel.innerText(), /1 of 6 visits .* mentioned this issue.*3 of 5 visits/)
      assert.match(await panel.innerText(), /owner task was marked complete/)
      assert.equal(await panel.locator('form').count(), 0)
      if (process.env.TAP_TREND_SCREENSHOT) {
        await page.evaluate(() => document.fonts.ready)
        await panel.scrollIntoViewIfNeeded()
        await page.screenshot({ path: process.env.TAP_TREND_SCREENSHOT })
      }
      await panel.locator('summary').click()
      await panel.getByText(/Evaluated .*Asia\/Tokyo/).waitFor()
      console.log('Mobile follow-up:', await panel.innerText())
    } finally {
      await phone.close()
    }
    for (const role of ['anon', 'authenticated']) {
      await sql('set role ' + role)
      try {
        for (const q of [
          'select * from issue_playbooks',
          'select * from issue_activity',
          "select tap_create_issue($1,current_date,current_date,null,null,false,'cleanliness')",
          'select tap_attach_evidence($1,$2)',
        ]) {
          await assert.rejects(
            sql(q, q.includes('$2') ? [a.id, staff1] : q.includes('$1') ? [a.id] : []),
            /permission denied/,
          )
        }
      } finally {
        await sql('reset role')
      }
    }
    assert.equal(
      (await sql('select sum(remaining_claims)::int n from tap_analysis_locations'))[0].n,
      24,
    )
    assert.equal((await sql('select sum(attempts)::int n from tap_feedback'))[0].n, 0)
    assert.deepEqual(scopedCalls, [])
    assert.deepEqual(blockedBrowser, [])
    assert.equal(readFileSync(blockedFile, 'utf8'), '')
    console.log(
      'PASS desktop and phone, linked legacy plans, correction, original and added evidence, owner context, duplicate/replayed actions, task uniqueness, private reads and mutation denial. Paid claims 0; model calls 0; external TCP connections, provider calls, sends, bookings and payments 0.',
    )
  } finally {
    await browser.close()
  }
}
