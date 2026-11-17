import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('homepage display headings share the hero typography', async () => {
  const [globalStyles, showcaseStyles, faqStyles] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'ProductShowcase.module.css'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'HomeFaq.module.css'), 'utf8'),
  ])

  assert.match(globalStyles, /--home-display-size: 44px/)
  assert.match(globalStyles, /--home-display-weight: 400/)
  assert.match(globalStyles, /--home-display-line: 1\.05/)
  assert.match(globalStyles, /--home-display-tracking: -\.05em/)

  for (const selector of ['.lp-hero-centered > h1', '.section-intro > h2', '.promise-card h2', '.marketing-shell .final-cta h2']) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const declaration = globalStyles.match(new RegExp(`${escapedSelector} \\{([^}]+)\\}`))?.[1] ?? ''
    assert.match(declaration, /font-size: var\(--home-display-size\)/, `${selector} should use the shared size`)
    assert.match(declaration, /font-weight: var\(--home-display-weight\)/, `${selector} should use the shared weight`)
  }

  for (const stylesheet of [showcaseStyles, faqStyles]) {
    const declaration = stylesheet.match(/\.heading h2 \{([^}]+)\}/)?.[1] ?? ''
    assert.match(declaration, /font-size: var\(--home-display-size\)/)
    assert.match(declaration, /font-weight: var\(--home-display-weight\)/)
  }
})
