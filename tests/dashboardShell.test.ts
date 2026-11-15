import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('authenticated dashboard layout retains its server-side access boundary', () => {
  const layout = readFileSync('app/dashboard/layout.tsx', 'utf8')

  assert.match(layout, /supabase\.auth\.getUser\(\)/)
  assert.match(layout, /if \(!user\) redirect\('\/signin'\)/)
  assert.match(layout, /getAccountForAuthUser\(admin, user\)/)
  assert.match(layout, /DashboardAppShell/)
  assert.match(layout, /'\/dashboard\/feedback-demo'/)
})

test('dashboard navigation contains only working authenticated destinations', () => {
  const sidebar = readFileSync('app/dashboard/DashboardSidebar.tsx', 'utf8')

  assert.match(sidebar, /Feedback demo/)
  assert.match(sidebar, /Review center/)
  assert.match(sidebar, /YouTube Studio/)
  assert.match(sidebar, /Competitors/)
  assert.match(sidebar, /Review requests/)
  assert.match(sidebar, /Billing/)
  assert.match(sidebar, /Settings/)
  assert.match(sidebar, /\/dashboard\/review-requests/)
})

test('Ask Replova foundation routes to authorized workflows without fake chat', () => {
  const panel = readFileSync('components/dashboard/shell/AIAssistantPanel.tsx', 'utf8')

  assert.match(panel, /Evidence first/)
  assert.match(panel, /\/dashboard\/feedback-demo/)
  assert.match(panel, /#feedback-priorities/)
  assert.match(panel, /#customer-recovery/)
  assert.match(panel, /#improvement-tasks/)
  assert.match(panel, /\/dashboard\/youtube\/replies/)
  assert.doesNotMatch(panel, /<input|<textarea|fetch\(|dangerouslySetInnerHTML/)
})

test('dashboard shell is responsive, reduced-motion aware, and locally scoped', () => {
  const shell = readFileSync('components/dashboard/shell/DashboardAppShell.tsx', 'utf8')
  const header = readFileSync('components/dashboard/shell/DashboardHeader.tsx', 'utf8')
  const css = readFileSync('components/dashboard/shell/DashboardShell.module.css', 'utf8')

  assert.match(header, /aria-controls="dashboard-navigation"/)
  assert.match(header, /aria-controls="ask-replova-panel"/)
  assert.match(shell, /event\.key !== 'Escape'/)
  assert.match(shell, /replova:close-assistant/)
  assert.match(shell, /replova:close-feedback-recovery/)
  assert.match(css, /@media \(max-width: 1439px\)/)
  assert.match(css, /@media \(max-width: 899px\)/)
  assert.match(css, /@media \(max-width: 639px\)/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
})
