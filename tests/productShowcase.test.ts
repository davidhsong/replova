import assert from 'node:assert/strict'
import { access, readFile, stat } from 'node:fs/promises'
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

  assert.match(component, /Find the signal in every review\./)
  assert.match(component, /Thoughtful replies, in your voice\./)
  assert.match(component, /See what's improving\. Spot what's not\./)
  assert.match(component, /Turn feedback into a better way to work\./)
  assert.match(component, /Synthetic workspace/)
  assert.match(component, /href="\/demo"/)
  assert.doesNotMatch(component, /setInterval|setTimeout/)
  assert.doesNotMatch(component, /AlphaRun|Alpharun/)
})

test('showcase uses the four authentic unblurred Replova screenshot assets', async () => {
  const contextAssets = [
    'review-intelligence.png',
    'ai-reply-drafts.png',
    'feedback-analytics.png',
    'business-playbooks.png',
  ]

  for (const asset of contextAssets) {
    const filePath = path.join(repoRoot, 'public', 'product-showcase', asset)
    await access(filePath)
    assert.ok((await stat(filePath)).size > 100_000, `${asset} should contain a high-resolution dashboard capture`)
  }

  const focusAssets = [
    'review-intelligence-focus.png',
    'ai-reply-drafts-focus.png',
    'feedback-analytics-focus.png',
    'business-playbooks-focus.png',
  ]

  for (const asset of focusAssets) {
    const filePath = path.join(repoRoot, 'public', 'product-showcase', asset)
    await access(filePath)
    assert.ok((await stat(filePath)).size > 20_000, `${asset} should contain an authentic high-resolution Replova crop`)
  }
})

test('showcase styling includes selective focus, responsive tabs, transitions, and reduced motion', async () => {
  const stylesheet = await readFile(
    path.join(repoRoot, 'components', 'marketing', 'ProductShowcase.module.css'),
    'utf8',
  )

  assert.match(stylesheet, /filter: blur\(/)
  assert.match(stylesheet, /mask-image: linear-gradient/)
  assert.match(stylesheet, /rgba\(0, 0, 0, \.08\)[\s\S]*rgba\(0, 0, 0, \.34\)[\s\S]*rgba\(0, 0, 0, \.72\)/)
  assert.match(stylesheet, /linear-gradient\(145deg, #222426 0%, #696a69 50%, #c5c4bf 100%\)/)
  assert.match(stylesheet, /data-visual='feedback-analytics'[\s\S]*\.contextWindow[\s\S]*right: 4%/)
  assert.match(stylesheet, /data-visual='business-playbooks'[\s\S]*\.contextWindow[\s\S]*right: 3%/)
  assert.doesNotMatch(stylesheet, /#243f9d|#7143c4|#b95ab6/)
  assert.match(stylesheet, /400ms cubic-bezier/)
  assert.match(stylesheet, /overflow-x: auto/)
  assert.match(stylesheet, /@media \(max-width: 820px\)/)
  assert.match(stylesheet, /prefers-reduced-motion: reduce/)
  assert.match(stylesheet, /:focus-visible/)
})
