'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const primaryLinks = [
  { label: 'Platform', detail: 'Review intelligence and operational workflows', href: '/#platform' },
  { label: 'Solutions', detail: 'Use cases for customer-focused businesses', href: '/industries' },
  { label: 'Resources', detail: 'Practical customer-feedback guides', href: '/resources' },
] as const

export function MobileMarketingNav() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstLinkRef = useRef<HTMLAnchorElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => panelRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')]
        const first = focusable[0]
        const last = focusable.at(-1)

        if (document.activeElement === panelRef.current) {
          event.preventDefault()
          if (event.shiftKey) last?.focus()
          else first?.focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 821px)')
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false)
    }

    desktopQuery.addEventListener('change', closeAtDesktop)
    return () => desktopQuery.removeEventListener('change', closeAtDesktop)
  }, [])

  function closeMenu(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="mobile-marketing-menu-toggle"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-controls="mobile-marketing-menu"
        aria-expanded={open}
        data-open={open}
        onClick={() => setOpen(current => !current)}
      >
        <span /><span /><span />
      </button>

      <div className="mobile-marketing-menu-layer" data-open={open} aria-hidden={!open}>
        <button
          type="button"
          className="mobile-marketing-menu-backdrop"
          aria-label="Close navigation menu"
          tabIndex={open ? 0 : -1}
          onClick={() => closeMenu(true)}
        />
        <aside ref={panelRef} id="mobile-marketing-menu" className="mobile-marketing-menu-panel" aria-label="Mobile navigation" tabIndex={-1}>
          <div className="mobile-marketing-menu-heading">
            <span>Navigation</span>
            <small>Replova</small>
          </div>
          <nav aria-label="Mobile main navigation">
            {primaryLinks.map((link, index) => (
              <Link
                key={link.label}
                ref={index === 0 ? firstLinkRef : undefined}
                href={link.href}
                tabIndex={open ? 0 : -1}
                onClick={() => closeMenu()}
              >
                <span><strong>{link.label}</strong><small>{link.detail}</small></span>
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </Link>
            ))}
          </nav>
          <div className="mobile-marketing-menu-actions">
            <Link href="/signin" tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Sign in</Link>
            <Link href="/demo" tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Request a demo</Link>
          </div>
        </aside>
      </div>
    </>
  )
}
