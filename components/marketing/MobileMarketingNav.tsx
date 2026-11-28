'use client'

import { productLinks, industryLinks } from '@/lib/marketingNavigation'
import { NavItemIcon, type NavIconName } from './NavItemIcon'
import { NavDestination } from './NavDestination'
import { IndustryDemoLink } from './IndustryBooking'
import { trackIndustry } from './industryAnalytics'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type MobileNavItem = {
  label: string
  detail: string
  href: string
  icon: NavIconName
}

type MobileNavGroup = {
  label: string
  items: readonly MobileNavItem[]
}

const menuGroups: readonly MobileNavGroup[] = [
  {
    label: 'Products',
    items: productLinks.map(([label, detail, href, icon]) => ({ label, detail, href, icon })),
  },
  {
    label: 'Industries',
    items: industryLinks.map(([label, detail, href, icon]) => ({ label, detail, href, icon })),
  },
  {
    label: 'Resources',
    items: [
      { label: 'Resource center', detail: 'Practical guidance for customer-focused operators.', href: '/resources', icon: 'guide' },
      { label: 'Customer review research', detail: 'Published evidence behind review intelligence.', href: '/resources/customer-review-research', icon: 'research' },
      { label: 'Replying to reviews', detail: 'Write useful replies for every review type.', href: '/resources#replying', icon: 'reply' },
    ],
  },
] as const

function MenuChevron() {
  return (
    <svg className="mobile-marketing-menu-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

export function MobileMarketingNav({ tapHome = false, industry }: { tapHome?: boolean; industry?: string }) {
  const [open, setOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = requestAnimationFrame(() => panelRef.current?.focus())

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        setExpandedGroup(null)
        requestAnimationFrame(() => triggerRef.current?.focus())
        return
      }

      if (event.key === 'Tab' && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])')]
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

    function handleOutside(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setExpandedGroup(null)
      }
    }

    document.addEventListener('pointerdown', handleOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', handleOutside)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 821px)')
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpen(false)
        setExpandedGroup(null)
      }
    }

    desktopQuery.addEventListener('change', closeAtDesktop)
    return () => desktopQuery.removeEventListener('change', closeAtDesktop)
  }, [])

  function closeMenu(restoreFocus = false) {
    setOpen(false)
    setExpandedGroup(null)
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
        onClick={() => {
          setOpen(current => !current)
          if (open) setExpandedGroup(null)
        }}
      >
        <span /><span /><span />
      </button>

      <div className="mobile-marketing-menu-layer" data-open={open} aria-hidden={!open} inert={!open} onClick={event => { if (event.target === event.currentTarget) closeMenu(true) }}>
        <aside ref={panelRef} id="mobile-marketing-menu" className="mobile-marketing-menu-panel" aria-label="Mobile navigation" tabIndex={-1}>
          <nav className="mobile-marketing-menu-groups" aria-label="Mobile main navigation">
            {menuGroups.map((group, index) => {
              const expanded = expandedGroup === group.label
              const submenuId = `mobile-${group.label.toLowerCase()}-menu`
              return (
                <div className="mobile-marketing-menu-group" data-expanded={expanded} key={group.label} style={{ '--mobile-menu-index': index } as React.CSSProperties}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={submenuId}
                    tabIndex={open ? 0 : -1}
                    onClick={() => {
                      if (!expanded && group.label === 'Industries') trackIndustry('industry_menu_open')
                      setExpandedGroup(expanded ? null : group.label)
                    }}
                  >
                    <span>{group.label}</span>
                    <MenuChevron />
                  </button>
                  <div className="mobile-marketing-submenu" id={submenuId} data-open={expanded} aria-hidden={!expanded}>
                    <div>
                      {group.items.map(item => (
                        <NavDestination href={tapHome && item.href.startsWith('/#') ? item.href.slice(1) : item.href} key={item.label} tabIndex={open && expanded ? 0 : -1} onClick={() => {
                          if (group.label === 'Industries' && item.href.startsWith('/industries/')) trackIndustry('industry_select', item.href.split('/')[2])
                          closeMenu()
                        }}>
                          <NavItemIcon name={item.icon} className="mobile-marketing-submenu-icon" />
                          <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                        </NavDestination>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            <Link className="mobile-marketing-menu-signin" href="/signin" tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Sign in</Link>
          </nav>
          <div className="mobile-marketing-menu-actions">
            <IndustryDemoLink industry={industry} tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Request a demo</IndustryDemoLink>
          </div>
        </aside>
      </div>
    </>
  )
}
