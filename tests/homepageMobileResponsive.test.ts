import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()

test('marketing header exposes an accessible animated mobile menu', async () => {
  const [header, mobileMenu, css] = await Promise.all([
    readFile(path.join(root, 'components/MarketingChrome.tsx'), 'utf8'),
    readFile(path.join(root, 'components/marketing/MobileMarketingNav.tsx'), 'utf8'),
    readFile(path.join(root, 'app/globals.css'), 'utf8'),
  ])

  assert.match(header, /<MobileMarketingNav\s*\/>/)
  assert.match(mobileMenu, /aria-expanded=\{open\}/)
  assert.match(mobileMenu, /aria-controls="mobile-marketing-menu"/)
  assert.match(mobileMenu, /event\.key === 'Escape'/)
  assert.match(mobileMenu, /event\.key === 'Tab'/)
  assert.match(mobileMenu, /document\.body\.style\.overflow = 'hidden'/)
  assert.match(mobileMenu, /Platform/)
  assert.match(mobileMenu, /Solutions/)
  assert.match(mobileMenu, /Resources/)
  assert.match(mobileMenu, /Sign in/)
  assert.match(mobileMenu, /Request a demo/)
  assert.match(css, /\.mobile-marketing-menu-panel[\s\S]*transform: translate3d\(-102%, 0, 0\)/)
  assert.match(css, /\.mobile-marketing-menu-layer\[data-open='true'\][\s\S]*visibility: visible/)
})

test('homepage mobile layout centers the hero action and avoids clipped showcase tabs', async () => {
  const [home, globalCss, showcaseCss] = await Promise.all([
    readFile(path.join(root, 'app/page.tsx'), 'utf8'),
    readFile(path.join(root, 'app/globals.css'), 'utf8'),
    readFile(path.join(root, 'components/marketing/ProductShowcase.module.css'), 'utf8'),
  ])

  assert.match(home, /hero-actions hero-actions-centered/)
  assert.match(globalCss, /\.hero-actions-centered \{ width: 100%; align-items: center; justify-content: center; \}/)
  assert.match(showcaseCss, /@media \(max-width: 620px\)[\s\S]*\.tabList \{ min-width: 0; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(showcaseCss, /\.activeIndicator\[data-index='3'\] \{ transform: translate3d\(calc\(100% \+ 8px\), 52px, 0\); \}/)
})
