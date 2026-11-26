import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('homepage uses one interactive four-tab Replova product showcase', async () => {
  const [page, component] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'ProductShowcase.tsx'), 'utf8'),
  ])

  assert.match(page, /<ProductShowcase\s*\/>/)
  assert.equal((page.match(/<ProductShowcase\s*\/>/g) ?? []).length, 1)
  assert.match(component, /role="tablist"/)
  assert.match(component, /role="tab"/)
  assert.match(component, /role="tabpanel"/)
  assert.match(component, /ArrowRight/)
  assert.match(component, /ArrowLeft/)
  assert.match(component, /Home/)
  assert.match(component, /End/)
})

test('showcase copy accurately covers the four requested Replova features', async () => {
  const component = await readFile(
    path.join(repoRoot, 'components', 'marketing', 'ProductShowcase.tsx'),
    'utf8',
  )

  const samples = await readFile(path.join(repoRoot, 'components/marketing/VisitSample.tsx'), 'utf8')
  for (const label of ['Replova Tap', 'Feedback inbox', 'Recurring issues', 'Playbooks']) {
    assert.ok(samples.includes(`label: '${label}'`))
  }
  assert.match(samples, /Sample data/)
  assert.match(component, /href="\/demo"/)
  assert.doesNotMatch(component, /setInterval|setTimeout/)
})

test('the local illustrations preserve the rating, comments, issue and owner across tabs', async () => {
  const sample = await readFile(path.join(repoRoot, 'components/marketing/VisitSample.tsx'), 'utf8')
  assert.match(sample, /rating: 3, comment: 'I couldn’t tell where to go when I arrived/)
  assert.match(sample, /I had to ask where the line starts/)
  assert.match(sample, /2 of 6 visits/)
  assert.match(sample, /Put a ‘Start here’ sign at the entrance/)
  assert.match(sample, /Shift lead/)
})

test('screenshot stage preserves product colors and accessible tab states', async () => {
  const stylesheet = await readFile(path.join(repoRoot, 'components/marketing/ProductShowcase.module.css'), 'utf8')
  assert.match(stylesheet, /\.visualStage \{[^}]*linear-gradient\(90deg, #000000 0%, #061737/)
  assert.doesNotMatch(stylesheet, /(?:^|[;{\s])filter:\s*(blur|saturate|contrast)/)
  assert.match(stylesheet, /overflow-x: auto/)
  assert.match(stylesheet, /@media \(max-width: 820px\)/)
  assert.match(stylesheet, /prefers-reduced-motion: reduce/)
  assert.match(stylesheet, /:focus-visible/)
})
