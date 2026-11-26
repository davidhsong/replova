import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('resources retain scoped published findings and real evidence links', async () => {
  const [home, component, evidencePage] = await Promise.all([
    readFile(path.join(root, 'app/page.tsx'), 'utf8'),
    readFile(path.join(root, 'components/marketing/ResearchProof.tsx'), 'utf8'),
    readFile(path.join(root, 'app/resources/customer-review-research/page.tsx'), 'utf8'),
  ])

  assert.match(home, /<ResearchProof \/>/)
  assert.match(component, /REVIEWS\.io/)
  assert.match(component, /94%/)
  assert.match(component, /2,631/)
  assert.match(component, /Marketing Science/)
  assert.match(component, /\+0\.12 stars/)
  assert.match(component, /Medill Spiegel Research Center/)
  assert.match(component, /medill-spiegel-research-center\.jpg/)
  assert.match(component, /research-study-source-image-medill/)
  assert.match(component, /270%/)
  assert.match(component, /Pew Research Center/)
  assert.match(component, /pew-research-center\.svg/)
  assert.match(component, /research-study-source-image-pew/)
  assert.match(component, /4,787/)
  assert.match(component, /82%/)
  assert.doesNotMatch(component, /Study scope:/)
  assert.match(component, /Published research on customer reviews/)
  assert.doesNotMatch(component, /Trusted by customer-focused businesses/)
  assert.doesNotMatch(component, /Sunright Tea Studio|Happy Lemon|Sentral|WhatCoffee & Bakery|Clara Medical Spa|K &amp; S/)
  assert.doesNotMatch(component, /trusted-business/)
  assert.match(component, /informs-society-for-marketing-science\.jpg/)
  assert.match(component, /reviewsio-logo-black\.svg/)
  assert.match(component, /preserveSourceLogo: true/)
  assert.doesNotMatch(component, /Harvard Business School/)
  assert.match(component, /\/resources\/customer-review-research#reputation/)
  assert.match(component, /\/resources\/customer-review-research#responses/)
  assert.match(component, /\/resources\/customer-review-research#purchase/)
  assert.match(component, /\/resources\/customer-review-research#review-habits/)

  assert.match(evidencePage, /What not to assume/)
  assert.match(evidencePage, /not a promise/i)
  assert.match(evidencePage, /not a universal local-business conversion rate/i)
  assert.match(evidencePage, /2022-state-of-reviews-io-uk\.pdf/)
  assert.match(evidencePage, /pubsonline\.informs\.org/)
  assert.match(evidencePage, /spiegel\.medill\.northwestern\.edu/)
  assert.match(evidencePage, /pewresearch\.org\/internet\/2016\/12\/19\/online-reviews/)
  assert.doesNotMatch(component, /guaranteed|customer testimonial|Replova increased/i)
})

test('research section keeps monochrome, responsive, and accessible states', async () => {
  const css = await readFile(path.join(root, 'app/globals.css'), 'utf8')

  assert.doesNotMatch(css, /\.trusted-business/)
  assert.match(css, /\.research-study-source-image-pew \{ filter: brightness\(0\); mix-blend-mode: normal; \}/)
  assert.match(css, /\.research-study-source-image-original \{ filter: none; mix-blend-mode: normal; \}/)
  assert.match(css, /\.research-study-meta a:focus-visible/)
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.research-proof-grid \{ grid-template-columns: 1fr; \}/)
})
