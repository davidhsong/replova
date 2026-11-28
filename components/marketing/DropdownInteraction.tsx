'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { trackIndustry } from './industryAnalytics'

export function DropdownInteraction({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [mode, setMode] = useState<'closed' | 'hover' | 'button'>('closed')
  const open = mode !== 'closed'

  function show(next: 'hover' | 'button') {
    setMode(next)
  }

  useEffect(() => {
    if (!open) return
    if (label === 'Industries') trackIndustry('industry_menu_open')
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setMode('closed')
    }
    function otherMenu(event: PointerEvent) {
      if ((event.target as Element).closest('.nav-dropdown') && !root.current?.contains(event.target as Node)) setMode('closed')
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMode('closed')
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('pointerover', otherMenu)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('pointerover', otherMenu)
      document.removeEventListener('keydown', escape)
    }
  }, [open, label])

  return <div className="nav-dropdown" ref={root} data-open={open}
    onPointerEnter={event => { if (event.pointerType === 'mouse' && !open) show('hover') }}
    onPointerLeave={() => { if (mode === 'hover' && !root.current?.contains(document.activeElement)) setMode('closed') }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMode('closed') }}
    onKeyDown={event => {
      if (event.key === 'ArrowDown' && event.target === trigger.current) {
        event.preventDefault()
        show('button')
        requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>('.nav-popover a')?.focus())
      }
    }}>
    <button className="nav-dropdown-trigger" type="button" ref={trigger} aria-expanded={open} aria-controls={id}
      onClick={() => mode === 'button' ? setMode('closed') : show('button')}>
      {label}<svg className="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <div className="nav-popover" id={id} aria-label={label + ' menu'} inert={!open}
      onClick={event => {
        const link = (event.target as HTMLElement).closest('a')
        if (!link) return
        if (link.dataset.industry) trackIndustry('industry_select', link.dataset.industry)
        setMode('closed')
      }}>{children}</div>
  </div>
}
