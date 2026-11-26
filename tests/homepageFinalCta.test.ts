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

  assert.match(page, /className="final-cta-copy"/)
  assert.match(page, /className="final-cta-visual">\s*<VisitSample feature="inbox"/)
  assert.match(page, /See Replova in action\./)
  assert.match(page, /href="\/demo"/)
  assert.match(stylesheet, /\.marketing-shell \.final-cta-inner[\s\S]*grid-template-columns: 1fr 1fr/)
})
