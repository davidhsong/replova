import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('homepage final CTA uses the Replova product card layout', async () => {
  const [page, stylesheet] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8'),
  ])

  assert.match(page, /import Image from 'next\/image'/)
  assert.match(page, /inbox\.png'/)
  assert.match(page, /className="final-cta-copy"/)
  assert.match(page, /className="final-cta-visual"/)
  assert.match(page, /className="final-cta-preview"/)
  assert.match(page, /See Replova in action\./)
  assert.match(page, /Request a demo/)

  assert.match(stylesheet, /\.marketing-shell \.final-cta-inner[\s\S]*grid-template-columns: 1fr 1fr/)
  const homeStyle = await readFile(path.join(repoRoot, 'app/tap-home.css'), 'utf8')
  assert.match(homeStyle, /\.tap-home \.final-cta-visual \{\s*background: linear-gradient\(145deg, #061737/)
  assert.match(stylesheet, /\.final-cta-preview[\s\S]*top: 15%[\s\S]*left: 10%/)
  assert.doesNotMatch(stylesheet.match(/\.final-cta-visual \{([^}]+)\}/)?.[1] ?? '', /purple|#243f9d|#7143c4|#b95ab6/)
})
