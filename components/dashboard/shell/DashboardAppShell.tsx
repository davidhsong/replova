'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { Plan } from '@/lib/planLimits'
import AIAssistantPanel from './AIAssistantPanel'
import DashboardHeader from './DashboardHeader'
import styles from './DashboardShell.module.css'

type Props = {
  children: ReactNode
  sidebar: ReactNode
  workspaceName: string
  plan: Plan
}

export default function DashboardAppShell({ children, sidebar, workspaceName, plan }: Props) {
  const pathname = usePathname()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [compactNavigation, setCompactNavigation] = useState(false)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

  useEffect(() => {
    const compactScreen = window.matchMedia('(max-width: 899px)')
    const syncNavigation = (event: MediaQueryListEvent | MediaQueryList) => {
      setCompactNavigation(event.matches)
    }

    const frame = window.requestAnimationFrame(() => syncNavigation(compactScreen))
    compactScreen.addEventListener('change', syncNavigation)
    return () => {
      window.cancelAnimationFrame(frame)
      compactScreen.removeEventListener('change', syncNavigation)
    }
  }, [])

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setNavigationOpen(false)
      if (window.matchMedia('(max-width: 1439px)').matches) {
        setAssistantOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    function closeAssistantForContextPanel() {
      setAssistantOpen(false)
    }

    window.addEventListener('replova:close-assistant', closeAssistantForContextPanel)
    return () => window.removeEventListener('replova:close-assistant', closeAssistantForContextPanel)
  }, [])

  useEffect(() => {
    const overlayAssistantOpen = assistantOpen && window.matchMedia('(max-width: 1439px)').matches
    const shouldLock = navigationOpen || overlayAssistantOpen
    if (!shouldLock) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [assistantOpen, navigationOpen])

  const overlayOpen = navigationOpen || assistantOpen

  return (
    <div
      className={`app ${styles.shell}`}
      data-assistant-open={assistantOpen}
      data-navigation-collapsed={navigationCollapsed}
    >
      <div
        id="dashboard-navigation"
        className={`${styles.navigationSlot} ${navigationOpen ? styles.navigationOpen : ''}`}
        aria-label="Application navigation"
        aria-hidden={compactNavigation && !navigationOpen}
        inert={compactNavigation && !navigationOpen ? true : undefined}
        onClickCapture={event => {
          if (event.target instanceof Element && event.target.closest('a')) {
            setNavigationOpen(false)
          }
        }}
      >
        {sidebar}
      </div>

      <section className={styles.workspace}>
        <DashboardHeader
          workspaceName={workspaceName}
          plan={plan}
          pathname={pathname}
          navigationOpen={navigationOpen}
          navigationCollapsed={navigationCollapsed}
          assistantOpen={assistantOpen}
          onNavigationToggle={() => setNavigationOpen(open => !open)}
          onNavigationCollapseToggle={() => setNavigationCollapsed(collapsed => !collapsed)}
          onAssistantToggle={() =>
            setAssistantOpen(open => {
              const nextOpen = !open
              if (nextOpen) {
                window.dispatchEvent(new CustomEvent('replova:close-feedback-recovery'))
              }
              return nextOpen
            })
          }
        />
        <main id="main-content" className={`main ${styles.contentFrame}`}>
          {children}
        </main>
      </section>

      <div
        id="ask-replova-panel"
        className={`${styles.assistantSlot} ${assistantOpen ? styles.assistantOpen : ''}`}
        aria-hidden={!assistantOpen}
        inert={!assistantOpen ? true : undefined}
        onClickCapture={event => {
          if (
            event.target instanceof Element &&
            event.target.closest('a') &&
            window.matchMedia('(max-width: 1439px)').matches
          ) {
            setAssistantOpen(false)
          }
        }}
      >
        <AIAssistantPanel pathname={pathname} workspaceName={workspaceName} onClose={() => setAssistantOpen(false)} />
      </div>

      {overlayOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close open panel"
          onClick={() => {
            setNavigationOpen(false)
            setAssistantOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
