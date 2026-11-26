'use client'

import { useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'

export function DropdownInteraction({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false)
  return (
    <div
      className="nav-dropdown"
      data-dismissed={dismissed}
      onPointerEnter={() => setDismissed(false)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDismissed(false)
      }}
      onKeyDown={event => {
        const trigger = event.currentTarget.querySelector<HTMLAnchorElement>('.nav-dropdown-trigger')
        if (event.key === 'Escape') {
          event.preventDefault()
          trigger?.focus()
          setDismissed(true)
        } else if (event.key === 'ArrowDown' && event.target === trigger) {
          event.preventDefault()
          const firstLink = event.currentTarget.querySelector<HTMLAnchorElement>('.nav-popover a')
          flushSync(() => setDismissed(false))
          firstLink?.focus()
        }
      }}
    >
      {children}
    </div>
  )
}
