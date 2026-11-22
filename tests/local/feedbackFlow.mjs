import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import jsQR from 'jsqr'

export async function rehearseFlow({ origin, session, client, scopedCalls, blockedFile }) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const root = process.env.FLOW_ARTIFACTS
  if (root) mkdirSync(root, { recursive: true })
  const fixture = readFileSync('tests/sql/feedbackFlowDemo.sql', 'utf8')
  const id = '7170de00-69ce-4280-854c-ba19c7325401',
    second = id.replace('5401', '5402')
  await client.query(fixture)
  const own = await client.query(
    'select w.id from business_workspaces w join accounts a on a.id=w.account_id where a.owner_email=$1',
    [session.user.email],
  )
  await client.query('update restaurants set owner_email=$1,workspace_id=$2 where id=$3', [
    session.user.email,
    own.rows[0].id,
    id,
  ])
  await client.query(
    "insert into restaurants(id,name,owner_email,workspace_id,active) values($1,'Second location',$2,$3,true)",
    [second, session.user.email, own.rows[0].id],
  )
  const {
    rows: [placard],
  } = await client.query(
    "insert into tap_placards(location_id,placement) values($1,'Welcome counter') returning id",
    [second],
  )
  await client.query(
    "insert into tap_feedback(id,location_id,placard_id,rating,comment,analysis_status,is_test) values(gen_random_uuid(),$1,$2,4,'Waiting for analysis','working',false)",
    [second, placard.id],
  )
  const before = async () =>
    (
      await client.query(
        'select (select count(*) from tap_feedback) visits,(select count(*) from issue_activity) activity,(select sum(remaining_claims) from tap_analysis_locations) claims',
      )
    ).rows[0]
  const snapshot = await before()
  const browser = await chromium.launch()
  const date = 'start=2026-11-01&end=2026-11-30'
  const url = origin + '/dashboard/feedback?' + date
  async function select(c, location) {
    assert.equal(
      (
        await c.request.post(origin + '/api/active-location', { data: { restaurantId: location } })
      ).status(),
      200,
    )
  }
  const save = async (el, name) => {
    if (root) await el.screenshot({ path: path.join(root, name + '.png') })
  }
  try {
    for (const width of [390, 320, 1280]) {
      const mobile = width < 500
      const c = await browser.newContext({
        viewport: { width, height: 844 },
        hasTouch: mobile,
        reducedMotion: width === 320 ? 'reduce' : 'no-preference',
        ...(width === 390 && root
          ? { recordVideo: { dir: root, size: { width, height: 844 } } }
          : {}),
      })
      await c.addCookies([
        {
          name: 'sb-127-auth-token',
          value: 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url'),
          url: origin,
        },
      ])
      await select(c, id)
      const p = await c.newPage()
      try {
        await p.goto(url + '#feedback-flow')
        const card = p.locator('#feedback-flow')
        await card.scrollIntoViewIfNeeded()
        const graphic = card.locator('svg:visible')
        await graphic
          .getByRole('link', {
            name: 'With a comment → Issue reported · 6 submissions',
            exact: true,
          })
          .waitFor()
        await p.waitForTimeout(1450)
        assert.equal(
          await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          true,
        )
        assert.ok(
          await graphic
            .locator('g[class]')
            .evaluateAll((gs) => gs.every((g) => Number(getComputedStyle(g).opacity) === 1)),
        )
        if (width === 320) assert.notEqual(await card.getAttribute('data-motion'), 'reveal')
        await save(card, 'flow-' + width)
        const urgent = graphic.locator('[data-band="urgent"]')
        if (mobile) {
          const pt = await urgent.evaluate((path) => {
            const box = path.getBoundingClientRect()
            for (let y = box.top + 3; y < box.bottom - 2; y += 2)
              for (let x = box.left + 2; x < box.right - 2; x += 2) {
                if (document.elementFromPoint(x, y) === path) return { x, y }
              }
            throw Error('No tappable urgent ribbon')
          })
          await p.touchscreen.tap(pt.x, pt.y)
        } else {
          await urgent.locator('..').focus()
          assert.match(await card.innerText(), /Issue reported → Urgent · 2 submissions/)
          await p.keyboard.press('Enter')
        }
        const inbox = p.locator('#evidence')
        await inbox.getByRole('heading', { name: 'Urgent', exact: true }).waitFor()
        assert.deepEqual(
          (await inbox.locator('article').evaluateAll((els) => els.map((e) => e.id))).sort(),
          [1, 2].map((n) => 'entry-7170de00-69ce-4280-854c-ba19c732560' + n),
        )
        assert.match(p.url(), /start=2026-11-01/)
        await p.waitForTimeout(1000)
        if (width === 390) continue
        await inbox.getByText('Back to feedback flow').click()
        await card.waitFor()
        if (width === 1280) {
          await save(p.locator('a[aria-label="Replova dashboard"]:visible').first(), 'dashboard')
          await p.goto(origin)
          await save(p.locator('a[aria-label="Replova home"]:visible').first(), 'header')
          await p.goto(origin + '/dashboard/tap')
          const download = p.getByRole('link', { name: 'Download printable QR' }).first()
          const src = await download.getAttribute('href')
          const target = await p.locator('.pilot-placard code').first().innerText()
          const png = await p.evaluate(async (src) => {
            const img = new Image()
            img.src = src
            await img.decode()
            const cv = document.createElement('canvas')
            cv.width = img.width
            cv.height = img.height
            const ctx = cv.getContext('2d')
            ctx.drawImage(img, 0, 0)
            return {
              width: cv.width,
              height: cv.height,
              pixels: Array.from(ctx.getImageData(0, 0, cv.width, cv.height).data),
            }
          }, src)
          assert.equal(
            jsQR(Uint8ClampedArray.from(png.pixels), png.width, png.height)?.data,
            target,
          )
          await save(p.locator('.pilot-placard img').first(), 'placard')
          await p.goto(target)
          await save(p.locator('main img'), 'customer')
          await p.goto(origin + '/favicon.ico')
          await save(p.locator('img'), 'favicon')
          await select(c, second)
          await p.goto(origin + '/dashboard/feedback')
          await p
            .locator('#feedback-flow')
            .getByRole('link', { name: /With a comment → Analysis pending · 1 submission/ })
            .first()
            .waitFor()
          await p.goto(origin + '/dashboard/feedback?start=2000-01-01&end=2000-01-02')
          await p
            .locator('#feedback-flow')
            .getByText('No submissions match these filters.')
            .waitFor()
        }
      } finally {
        const video = p.video()
        await c.close()
        if (video && root) await video.saveAs(path.join(root, 'feedback-flow-mobile.webm'))
      }
    }
    assert.deepEqual(await before(), snapshot)
    assert.equal(scopedCalls.length, 0)
    assert.equal(readFileSync(blockedFile, 'utf8').trim(), '')
    console.log(
      'PASS owner flow at 320/390/1280, distinct urgent IDs, touch and keyboard, reduced motion, location switch, pending and empty, QR round trip, zero writes to feedback/claims/activity and zero egress.',
    )
  } finally {
    await browser.close()
  }
}
