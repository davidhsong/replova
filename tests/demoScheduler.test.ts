import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('demo scheduler provides month, weekly grid, and weekly column views', async () => {
  const [component, stylesheet, page] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'demo', 'DemoScheduler.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'demo', 'DemoScheduler.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'demo', 'page.tsx'), 'utf8'),
  ])

  assert.match(component, /type CalendarView = 'month' \| 'week-grid' \| 'week-columns'/)
  assert.match(component, /aria-label="Month view"/)
  assert.match(component, /aria-label="Weekly grid view"/)
  assert.match(component, /aria-label="Weekly column view"/)
  assert.match(component, /aria-label="Time format"/)
  assert.match(component, /Replova Introduction/)
  assert.match(component, /Organizer&apos;s default app/)
  assert.match(component, /America\/Los Angeles/)
  assert.match(component, /calendar delivery is not connected yet/i)
  assert.match(stylesheet, /grid-template-columns:\s*424px minmax\(0, 1fr\)/)
  assert.match(stylesheet, /repeating-linear-gradient/)
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/)
  assert.match(page, /title: 'Schedule a Demo'/)
})
