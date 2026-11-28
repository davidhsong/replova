import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

export async function checkPublicNavigation(origin) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await page.goto(origin)
    const labels = ['Tea brands', 'Hotels', 'Multifamily', 'Restaurants', 'Retail', 'Fitness', 'Auto service', 'All industries']
    const productNames = ['Replova Dot', 'Replova Tap', 'Replova AI']
    const products = page.getByRole('button', { name: 'Products', exact: true })
    await products.click()
    assert.deepEqual(await page.locator('.nav-popover:visible strong').allTextContents(), productNames)
    await page.locator('.lp-hero-centered').click({ position: { x: 32, y: 100 } })
    assert.equal(await products.getAttribute('aria-expanded'), 'false')
    const trigger = page.getByRole('button', { name: 'Industries', exact: true })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = trigger.locator('..').locator('.nav-popover')
    assert.deepEqual(await menu.locator('strong').allTextContents(), labels)
    await page.keyboard.press('Tab')
    assert.match(await page.evaluate(() => document.activeElement.textContent), /Tea brands/)
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.ok(await trigger.evaluate(button => button === document.activeElement))
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => document.activeElement?.textContent.includes('Tea brands'))
    await menu.getByRole('link', { name: /All industries/ }).click()
    await page.waitForURL('**/industries')
    assert.ok(await page.locator('.industry-card').count() > labels.length)
    await page.setViewportSize({ width: 390, height: 600 })
    await page.getByLabel('Open navigation menu').click()
    const mobile = page.locator('#mobile-marketing-menu')
    await mobile.getByRole('button', { name: 'Products' }).click()
    assert.deepEqual(await mobile.locator('#mobile-products-menu strong').allTextContents(), productNames)
    await mobile.getByRole('button', { name: 'Industries' }).click()
    assert.deepEqual(await mobile.locator('#mobile-industries-menu strong').allTextContents(), labels)
    await mobile.getByRole('link', { name: /All industries/ }).scrollIntoViewIfNeeded()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open navigation menu')
    for (const [index, slug] of ['replova-dot', 'replova-tap', 'replova-ai'].entries()) {
      await page.goto(origin + '/products/' + slug)
      const main = page.getByRole('main')
      assert.equal(await main.locator('h1').innerText(), productNames[index])
      assert.equal(await main.locator('img').count(), slug === 'replova-ai' ? 0 : 1)
      assert.equal(await main.locator('svg, video, canvas, iframe, blockquote, form').count(), 0)
      assert.equal(await main.getByRole('link', { name: 'Request a demo' }).getAttribute('href'), '/demo')
    }
    await page.goto(origin + '/platform/how-tap-works?from=guide')
    assert.ok(page.url().endsWith('/products/replova-tap?from=guide#how-it-works'))
    await page.reload()
    const heading = page.getByRole('heading', { name: 'How Tap works' })
    await page.waitForFunction(() => {
      const y = document.querySelector('#how-it-works').getBoundingClientRect().top
      return y >= document.querySelector('.lp-header').getBoundingClientRect().bottom && y < innerHeight
    })
    assert.ok(await heading.isVisible())
    await page.goto(origin + '/dashboard-preview')
    assert.equal(await page.getByRole('main').count(), 1)
    await page.getByRole('button', { name: 'Open the parking Playbook action' }).click()
    await page.getByRole('button', { name: /Mark overnight parking/ }).click()
    await page.getByLabel(/Switch feature/).click()
    await page.getByRole('menuitem', { name: /Customer Feedback/ }).click()
    await page.getByRole('button', { name: 'Review requests', exact: true }).click()
    await page.getByText('31.1%', { exact: true }).waitFor()
    await page.getByText('72.7% of delivered').waitFor()
    console.log('PASS keyboard dropdown, mobile drawer, private feedback to Playbook and campaign metrics')
  } finally {
    await browser.close()
  }
}
