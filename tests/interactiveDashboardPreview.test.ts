import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('standalone dashboard preview is interactive and covers the product workspace', async () => {
  const [page, component] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'InteractiveDashboardPreview.tsx'), 'utf8'),
  ])

  assert.match(page, /href="#sample-feedback"/)
  assert.doesNotMatch(page, /<InteractiveDashboardPreview/)
  assert.match(component, /defaultAssistantOpen = false/)
  assert.match(component, /entry\.contentRect\.width <= 690/)
  assert.match(component, /Customer Feedback/)
  assert.match(component, /Business Playbook/)
  assert.match(component, /Google Business Profile/)
  assert.match(component, /YouTube Studio/)
  assert.match(component, /Review requests/)
  assert.match(component, /Competitor tracking/)
  assert.match(component, /Ask Replova/)
  assert.match(component, /AnimatedTrend/)
  assert.match(component, /Approve suggestion/)
  assert.match(component, /Apply to Playbook/)
  assert.match(component, /Billing/)
  assert.match(component, /Settings/)
})

test('public preview stays synthetic and cannot invoke production actions', async () => {
  const component = await readFile(
    path.join(repoRoot, 'components', 'marketing', 'InteractiveDashboardPreview.tsx'),
    'utf8',
  )

  assert.match(component, /Synthetic workspace/)
  assert.match(component, /No customer records are loaded and nothing can be posted to Google/)
  assert.match(component, /never requests OAuth access, synchronizes reviews, or publishes replies/)
  assert.match(component, /Unattended publishing remains disabled/)
  assert.doesNotMatch(component, /fetch\s*\(/)
  assert.doesNotMatch(component, /getSupabase/)
})

test('preview styling includes hover, chart, responsive, focus, and reduced-motion states', async () => {
  const stylesheet = await readFile(
    path.join(repoRoot, 'components', 'marketing', 'InteractiveDashboardPreview.module.css'),
    'utf8',
  )

  assert.match(stylesheet, /\.statCard:hover/)
  assert.match(stylesheet, /@keyframes preview-line-draw/)
  assert.match(stylesheet, /@container \(max-width: 690px\)/)
  assert.match(stylesheet, /:focus-visible/)
  assert.match(stylesheet, /prefers-reduced-motion: reduce/)
})

test('full dashboard preview reuses the same interactive component', async () => {
  const page = await readFile(path.join(repoRoot, 'app', 'dashboard-preview', 'page.tsx'), 'utf8')
  assert.match(page, /<InteractiveDashboardPreview variant="page"\s*\/>/)
  assert.match(page, /synthetic data and cannot post, publish, or contact customers/i)
})
