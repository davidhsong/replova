import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('promise workflow replays when the visual re-enters the viewport', async () => {
  const [page, component, stylesheet] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'PromiseWorkflowVisual.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8'),
  ])

  assert.match(page, /<PromiseWorkflowVisual\s*\/>/)
  assert.match(component, /^'use client'/)
  assert.match(component, /IntersectionObserver/)
  assert.match(component, /threshold: \[0, 0\.35\]/)
  assert.match(component, /entry\.intersectionRatio >= 0\.35/)
  assert.match(component, /className="promise-draft-stage"/)
  assert.match(component, /d="M 0 0 V 100 H 26"/)
  assert.match(stylesheet, /\.promise-draft-stage \{[^}]*padding-top: 36px/)
  assert.match(stylesheet, /\.promise-connector \{[^}]*left: 26px[^}]*width: 26px[^}]*height: calc\(50% \+ 18px\)/)
  assert.match(stylesheet, /@keyframes promise-customer-rise/)
  assert.match(stylesheet, /@keyframes promise-connector-draw/)
  assert.match(stylesheet, /@keyframes promise-draft-descend/)
  assert.match(stylesheet, /prefers-reduced-motion: reduce[\s\S]*promise-customer-review/)
})

test('promise heading uses the shared homepage display typography', async () => {
  const stylesheet = await readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8')
  const promiseHeading = stylesheet.match(/\.promise-card h2 \{([^}]+)\}/)?.[1] ?? ''

  assert.match(promiseHeading, /font-size: var\(--home-display-size\)/)
  assert.match(promiseHeading, /font-weight: var\(--home-display-weight\)/)
  assert.match(promiseHeading, /letter-spacing: var\(--home-display-tracking\)/)
  assert.match(promiseHeading, /line-height: var\(--home-display-line\)/)
})
