import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const repoRoot = process.cwd()

test('homepage sentiment chart replays synchronized greyscale segments with minimal colored deltas', async () => {
  const [page, component, stylesheet] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'AnimatedStoryBarChart.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'globals.css'), 'utf8'),
  ])

  assert.match(page, /<AnimatedStoryBarChart\s*\/>/)
  assert.match(component, /^'use client'/)
  assert.match(component, /const Observer = window\.IntersectionObserver/)
  assert.match(component, /new Observer/)
  assert.match(component, /setIsVisible\(entry\.isIntersecting\)/)
  assert.match(component, /observer\.disconnect\(\)/)
  assert.match(component, /threshold:\s*0\.35/)
  assert.match(component, /story-bars-visible/)
  assert.match(component, /trendPoints\.map/)
  assert.match(component, /point\.value - trendPoints\[index - 1\]\.value/)
  assert.match(component, /delta > 0 \? 'up' : delta < 0 \? 'down'/)
  assert.match(component, /chartPoints\.slice\(0, -1\)\.map/)
  assert.match(component, /className="story-trend-segment"/)
  assert.match(component, /segmentDuration = 480/)
  assert.match(component, /segmentPause = 140/)
  assert.match(component, /pathLength="1"/)
  assert.match(component, /className="story-chart-point"/)
  assert.match(component, /story-chart-delta story-chart-delta-\$\{deltaTone\}/)
  assert.match(component, /aria-describedby={`story-chart-delta-\$\{index\}`}/)
  assert.doesNotMatch(component, /story-chart-insight/)

  assert.match(stylesheet, /transform:\s*scaleY\(0\)/)
  assert.match(stylesheet, /transform-origin:\s*center bottom/)
  assert.match(stylesheet, /@keyframes story-bar-rise/)
  assert.match(stylesheet, /\.story-bars-visible i:nth-child\(6\).*animation-delay:\s*550ms/)
  assert.match(stylesheet, /\.story-bars-visible \.story-trend-segment[^{]*{[^}]*480ms linear var\(--segment-delay\)/)
  assert.match(stylesheet, /height:\s*calc\(var\(--bar-height\) - 6px\)/)
  assert.match(stylesheet, /background:\s*#d9d9d5/)
  assert.doesNotMatch(stylesheet, /\.story-bars i\s*{[^}]*border-top:/)
  assert.match(stylesheet, /stroke:\s*#4a4a47/)
  assert.match(stylesheet, /@keyframes story-trend-segment-draw/)
  assert.match(stylesheet, /\.story-chart-delta-up\s*{\s*color:\s*#16794a/)
  assert.match(stylesheet, /\.story-chart-delta-down\s*{\s*color:\s*#b42318/)
  assert.match(stylesheet, /\.story-chart-point:hover \.story-chart-delta/)
  assert.match(stylesheet, /\.story-chart-point:focus-visible \.story-chart-delta/)
  assert.doesNotMatch(stylesheet, /story-chart-insight/)
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/)
  assert.match(stylesheet, /animation:\s*none !important/)
})
