import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

export async function checkPublicNavigation(origin) {
  assert.equal(origin, 'http://127.0.0.1:3673')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
    await page.goto(origin)
    const trigger = page.locator('.nav-dropdown-trigger').filter({ hasText: 'Solutions' })
    await trigger.focus()
    await trigger.locator('..').locator('.nav-popover').waitFor()
    await page.keyboard.press('Tab')
    assert.match(await page.evaluate(() => document.activeElement.textContent), /Healthcare/)
    await page.keyboard.press('Escape')
    await trigger.locator('..').locator('.nav-popover').waitFor({ state: 'hidden' })
    assert.ok(await trigger.evaluate(link => link === document.activeElement))
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => document.activeElement?.textContent.includes('Healthcare'))
    await page.keyboard.press('Escape')
    await page.keyboard.press('Enter')
    await page.waitForURL('**/industries')
    assert.equal(await page.locator('.solution-index-row').count(), 6)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByLabel('Open navigation menu').click()
    await page.locator('#mobile-marketing-menu').getByRole('button', { name: 'Solutions' }).click()
    assert.equal(await page.locator('#mobile-solutions-menu a:visible').count(), 7)
    await page.keyboard.press('Escape')
    assert.ok(await page.getByLabel('Open navigation menu').evaluate(button => button === document.activeElement))
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
