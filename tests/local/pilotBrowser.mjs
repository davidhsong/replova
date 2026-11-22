import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
export async function rehearse({ origin, cron, session, service, client }) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const browser = await chromium.launch({ headless: true })
  const owner = await browser.newContext({ viewport: { width: 1440, height: 950 } })
  await owner.addCookies([
    {
      name: 'sb-127-auth-token',
      value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
      url: origin,
    },
  ])
  const page = await owner.newPage()
  page.setDefaultTimeout(45000)
  const message = () => page.locator('body').innerText()
  async function font(p, sel) {
    await p.evaluate(() => document.fonts.ready)
    const el = p.locator(sel).first()
    assert.match(await el.evaluate((n) => getComputedStyle(n).fontFamily), /Montserrat/i)
    assert.ok(await p.evaluate(() => document.fonts.check('500 16px Montserrat')))
  }
  async function tick() {
    const res = await fetch(origin + '/api/cron/pilot', {
      headers: { Authorization: 'Bearer ' + cron },
    })
    assert.equal(res.status, 200, (await res.text()).slice(0, 350))
  }
  async function click(name) {
    const field = page.locator('input[name="revision"]').first(),
      previous = (await field.count()) ? await field.inputValue() : null
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().startsWith(origin + '/dashboard'),
      ),
      page.getByRole('button', { name, exact: true }).click(),
    ])
    if (previous !== null)
      await page.waitForFunction(
        (old) => document.querySelector('input[name="revision"]')?.value !== old,
        previous,
      )
  }
  async function see(text) {
    await page.getByText(text, { exact: false }).first().waitFor()
  }
  try {
    await page.goto(origin + '/dashboard', { waitUntil: 'domcontentloaded' })
    await see('Your first location')
    await page.getByRole('link', { name: 'Set up your Tap' }).click()
    await page.getByLabel('Location name').fill('Pilot front desk')
    await page.getByLabel('Location time zone').fill('America/Los_Angeles')
    await click('Create location')
    await see('Create a placard')
    await page.getByLabel('Placement (optional)').fill('Front counter')
    await click('Create Tap link')
    const link = await page
      .getByRole('link', { name: 'Preview and test form' })
      .getAttribute('href')
    assert.ok(link)
    await client.query('insert into tap_analysis_locations(location_id) select location_id from tap_placards where id=$1', [link.split('?')[0].split('/').pop()])
    await font(page, 'button')
    console.log(
      'Desktop workspace created a location, generated a QR and opened its test destination',
    )
    const customer = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    })
    const form = await customer.newPage()
    let visit = 0
    for (const isTest of [true, true, false, false]) {
      await form.goto(isTest ? link : link.split('?')[0])
      assert.equal(await form.locator('script').count(), 0)
      await font(form, 'legend')
      await form.locator('label').filter({ hasText: /^2$/ }).click()
      await form
        .getByLabel('Comment (optional)')
        .fill(visit++ === 0 ? 'Insects by the window' : 'Insects near the entrance')
      await form.getByRole('button', { name: 'Send feedback' }).click()
      assert.match(await form.locator('body').innerText(), /feedback was received/)
    }
    const original = link.split('?')[0],
      placard = original.split('/').pop()
    const headers = {
      apikey: service,
      Authorization: 'Bearer ' + service,
      'Content-Type': 'application/json',
    }
    const sample = await fetch(original + '?test=1')
    const newId = (await sample.text()).match(/name="encounter" value="([^"]+)"/)[1]
    const patch = await fetch('http://127.0.0.1:3674/rest/v1/tap_encounters?id=eq.' + newId, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ expires_at: '2000-01-01T00:00:00Z' }),
    })
    assert.ok(patch.ok)
    const submit = async (id, rating) =>
      fetch(original + '?test=1', {
        method: 'POST',
        body: new URLSearchParams({
          encounter: id,
          rating: String(rating),
          comment: 'Insects near the entrance',
        }),
      })
    const expired = await submit(newId, 2)
    assert.equal(expired.status, 410)
    assert.match(await expired.text(), /Start a fresh form/)
    const prior = await (
      await fetch(
        'http://127.0.0.1:3674/rest/v1/tap_feedback?select=id&placard_id=eq.' +
          placard +
          '&limit=1',
        { headers },
      )
    ).json()
    const replay = await Promise.all([submit(prior[0].id, 2), submit(prior[0].id, 2)])
    assert.ok(replay.every((r) => r.ok))
    assert.equal((await submit(newId, 8)).status, 422)
    console.log('HTTP expiry, validation and concurrent duplicate POST checks passed')
    console.log('Four visits submitted without JavaScript on mobile')
    await tick()
    await page.goto(origin + '/dashboard/feedback?test=1')
    await see('Analysis failed')
    await click('Retry analysis')
    await see('Analysis pending')
    await tick()
    await page.goto(origin + '/dashboard/feedback')
    await see('Pests and hygiene · 2 of 2 submissions')
    await font(page, '.issue-bar span')
    await page.getByRole('link', { name: 'Pests and hygiene · 2 of 2 submissions' }).click()
    await see('2 matching submissions')
    await page.goto(origin + '/dashboard/feedback?test=1')
    await see('Pests and hygiene · 2 of 2 submissions')
    // Exercise the existing saved-Playbook editor on a legacy snapshot.
    const [legacy] = (await client.query("select tap_quarter(location_id,false,true,'Pests and hygiene') id from tap_placards where id=$1",[placard])).rows
    await page.getByRole('link', { name: 'Pests and hygiene · 2 of 2 submissions' }).click()
    await page.getByText('Related saved Playbooks',{exact:true}).click()
    await page.locator('a[href="/dashboard/playbooks/'+legacy.id+'"]').click()
    await see('Test Playbook')
    await page.getByLabel('What happened and where?').fill('Insects observed near the entry')
    await click('Save incident')
    await page.getByLabel('Service scope').fill('Inspect entrance')
    await page.getByLabel('Service address or area').fill('Sample service area')
    await page.getByLabel('Maximum all-in cost (USD)').fill('120')
    const from = new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      until = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    await page.getByLabel('Earliest service date').fill(from)
    await page.getByLabel('Latest service date').fill(until)
    await click('Authorize service run')
    await see('Pause workflow')
    await tick()
    await page.reload()
    await click('Pause workflow')
    await see('Paused by owner')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('Edit authorized limits', { exact: true }).click()
    await page.getByLabel('Maximum all-in cost (USD)').fill('200')
    await click('Save updated authorization')
    await see('Paused by owner')
    await click('Resume workflow')
    await see('Pause workflow')
    for (let i = 0; i < 4; i++) await tick()
    await page.reload()
    await see('Booking confirmed')
    await page.getByText('View details and provider activity').click()
    await see('Provider result recorded')
    assert.ok(await page.getByText('Sample service A', { exact: true }).first().count())
    await page.getByLabel('What did you observe?').fill('Entrance inspected and clear')
    await click('Save verification')
    await see('Fix verified')
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      true,
    )
    await click('Reopen issue')
    await see('Save verification')
    const bookId = page.url().split('/').pop().split('?')[0],
      runUrl = page.url()
    const other = await (
      await fetch('http://127.0.0.1:3674/rest/v1/restaurants', {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          name: 'Other location',
          owner_email: 'other@example.invalid',
          active: true,
        }),
      })
    ).json()
    const forbidden = await (
      await fetch('http://127.0.0.1:3674/rest/v1/issue_playbooks', {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          location_id: other[0].id,
          quarter_start: '2026-01-01',
          theme: 'Private neighboring location evidence',
          snapshot: {},
        }),
      })
    ).json()
    assert.ok(bookId && forbidden[0].id)
    await page.goto(runUrl.replace(bookId, forbidden[0].id))
    assert.ok(!(await message()).includes('Private neighboring location evidence'))
    console.log('Cross-location Playbook read rejected')
    await page.goto(origin + '/')
    await font(page, 'h1')
    await page.goto(origin + '/dashboard-preview')
    await font(page, 'summary')
    console.log(
      'Mobile pause, budget change, resume, provider activity, confirmed sample booking, verification and reopening passed. Montserrat checked on marketing, owner, chart and customer controls.',
    )
  } catch (e) {
    console.error('Page:', page.url(), (await message().catch(() => '')).slice(0, 1000))
    throw e
  } finally {
    await browser.close()
  }
}
