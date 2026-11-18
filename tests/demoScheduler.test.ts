import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('demo scheduler provides calendar views and confirmed invite delivery', async () => {
  const [component, stylesheet, page, route] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'demo', 'DemoScheduler.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'demo', 'DemoScheduler.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'demo', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'api', 'demo', 'book', 'route.ts'), 'utf8'),
  ])

  assert.match(component, /type CalendarView = 'month' \| 'week-grid' \| 'week-columns'/)
  assert.match(component, /aria-label="Month view"/)
  assert.match(component, /aria-label="Weekly grid view"/)
  assert.match(component, /aria-label="Weekly column view"/)
  assert.match(component, /aria-label="Time format"/)
  assert.match(component, /Replova Introduction/)
  assert.match(component, /Calendar invite by email/)
  assert.match(component, /America\/Los Angeles/)
  assert.match(component, /Send calendar invite/)
  assert.match(component, /Demo scheduled/)
  assert.match(component, /fetch\('\/api\/demo\/book'/)
  assert.doesNotMatch(component, /calendar delivery is not connected yet/i)
  assert.match(stylesheet, /grid-template-columns:\s*424px minmax\(0, 1fr\)/)
  assert.match(stylesheet, /\.bookingPanel/)
  assert.match(stylesheet, /repeating-linear-gradient/)
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/)
  assert.match(page, /title: 'Schedule a Demo'/)
  assert.match(page, /await connection\(\)/)
  assert.match(page, /timeZone: DEMO_TIME_ZONE/)
  assert.match(route, /nodemailer\.createTransport/)
  assert.match(route, /icalEvent:/)
  assert.match(route, /bcc: ownerEmail/)
  assert.match(route, /delivery\.accepted\.some/)
  assert.match(route, /acceptedRecipient\(recipient, email\)/)
  assert.match(route, /request\.headers\.get\('origin'\) !== request\.nextUrl\.origin/)
  assert.match(route, /ZOHO_SMTP_PASSWORD/)
})
