'use client'

import { useEffect, useState } from 'react'
import { IconSun, IconMoon } from '@/components/icons'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('replova-theme', next) } catch {}
  }

  if (theme === null) {
    // Avoid flashing the wrong icon before we've read the real theme client-side.
    return <span className={`theme-toggle ${className}`} style={{ visibility: 'hidden' }} aria-hidden="true" />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-toggle ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <IconSun s={14} /> : <IconMoon s={14} />}
    </button>
  )
}
