'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

type MobileNavItem = {
  label: string
  detail: string
  href: string
  icon: 'review' | 'reply' | 'analytics' | 'playbook' | 'health' | 'home' | 'car' | 'briefcase' | 'shop' | 'pin' | 'guide' | 'research'
}

type MobileNavGroup = {
  label: string
  items: readonly MobileNavItem[]
}

const menuGroups: readonly MobileNavGroup[] = [
  {
    label: 'Platform',
    items: [
      { label: 'Replova Tap', detail: 'Collect private ratings with a tap or scan.', href: '/#platform', icon: 'review' },
      { label: 'Feedback inbox', detail: 'Read a visit for the selected location.', href: '/#sample-feedback', icon: 'reply' },
      { label: 'Recurring issues', detail: 'See the comments behind each count.', href: '/#sample-issue', icon: 'analytics' },
      { label: 'Playbooks', detail: 'See how the owner tracks a fix.', href: '/#sample-issue', icon: 'playbook' },
    ],
  },
  {
    label: 'Solutions',
    items: [
      { label: 'Healthcare & wellness', detail: 'Check-in and communication at each location.', href: '/industries/healthcare-wellness', icon: 'health' },
      { label: 'Home services', detail: 'Communication, punctuality, and service quality.', href: '/industries/home-services', icon: 'home' },
      { label: 'Automotive', detail: 'Trust, estimates, wait times, and repair quality.', href: '/industries/automotive', icon: 'car' },
      { label: 'Professional services', detail: 'Specific improvements across every office.', href: '/industries/professional-services', icon: 'briefcase' },
      { label: 'Retail & hospitality', detail: 'Location-level service and product trends.', href: '/industries/retail-hospitality', icon: 'shop' },
      { label: 'Any local business', detail: 'Collect private feedback at your location.', href: '/industries/local-businesses', icon: 'pin' },
    ],
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

function MobileNavGlyph({ name }: { name: MobileNavItem['icon'] }) {
  const paths: Record<MobileNavItem['icon'], React.ReactNode> = {
    review: <><path d="M5 4h14v12H9l-4 4V4Z" /><path d="M8 8h8M8 11h5" /></>,
    reply: <><path d="m9 8-4 4 4 4" /><path d="M6 12h7a5 5 0 0 1 5 5" /></>,
    analytics: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h20" /></>,
    playbook: <><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" /><path d="M8 8h7M8 12h7" /></>,
    health: <><path d="M12 20s-7-4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 10-7 10Z" /><path d="M9 12h6M12 9v6" /></>,
    home: <><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10M10 20v-6h4v6" /></>,
    car: <><path d="m5 16-1-2 2-6h12l2 6-1 2" /><path d="M5 16h14v4h-2v-2H7v2H5v-4Z" /></>,
    briefcase: <><path d="M4 7h16v13H4V7Zm5 0V4h6v3" /><path d="M4 12h16" /></>,
    shop: <><path d="M5 9h14l-1 11H6L5 9Z" /><path d="M8 9a4 4 0 0 1 8 0" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    guide: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21V5.5Z" /></>,
    research: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5M7 10h6M10 7v6" /></>,
  }

  return <svg className="mobile-marketing-submenu-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function MenuChevron() {
  return (
    <svg className="mobile-marketing-menu-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

export function MobileMarketingNav({ tapHome = false }: { tapHome?: boolean }) {
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

      <div className="mobile-marketing-menu-layer" data-open={open} aria-hidden={!open}>
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
                    onClick={() => setExpandedGroup(current => current === group.label ? null : group.label)}
                  >
                    <span>{group.label}</span>
                    <MenuChevron />
                  </button>
                  <div className="mobile-marketing-submenu" id={submenuId} data-open={expanded} aria-hidden={!expanded}>
                    <div>
                      {group.items.map(item => (
                        <Link href={tapHome && item.href.startsWith('/#') ? item.href.slice(1) : item.href} key={item.label} tabIndex={open && expanded ? 0 : -1} onClick={() => closeMenu()}>
                          <MobileNavGlyph name={item.icon} />
                          <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
            <Link className="mobile-marketing-menu-signin" href="/signin" tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Sign in</Link>
          </nav>
          <div className="mobile-marketing-menu-actions">
            <Link href="/demo" tabIndex={open ? 0 : -1} onClick={() => closeMenu()}>Request a demo</Link>
          </div>
        </aside>
      </div>
    </>
  )
}
