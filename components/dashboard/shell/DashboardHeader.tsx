import type { Plan } from '@/lib/planLimits'
import styles from './DashboardShell.module.css'

type Props = {
  workspaceName: string
  plan: Plan
  pathname: string
  navigationOpen: boolean
  assistantOpen: boolean
  onNavigationToggle: () => void
  onAssistantToggle: () => void
}

const PLAN_LABELS: Record<Plan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  agency: 'Agency',
}

function pageTrail(pathname: string) {
  if (pathname.startsWith('/dashboard/playbook/demo')) return ['Playbook', 'Synthetic demo']
  if (pathname.startsWith('/dashboard/playbook')) return ['Playbook']
  if (pathname.startsWith('/dashboard/feedback-demo')) return ['Feedback demo']
  if (pathname.startsWith('/dashboard/competitors')) return ['Competitors']
  if (pathname.startsWith('/dashboard/review-requests')) return ['Review requests']
  if (pathname.startsWith('/dashboard/applicants')) return ['Applicants']
  if (pathname.startsWith('/dashboard/billing')) return ['Billing']
  if (pathname.startsWith('/dashboard/settings')) return ['Settings']
  if (pathname.startsWith('/dashboard/youtube/videos/')) return ['YouTube Studio', 'Video comments']
  if (pathname.startsWith('/dashboard/youtube/videos')) return ['YouTube Studio', 'Videos']
  if (pathname.startsWith('/dashboard/youtube/playlists/')) return ['YouTube Studio', 'Playlist']
  if (pathname.startsWith('/dashboard/youtube/playlists')) return ['YouTube Studio', 'Playlists']
  if (pathname.startsWith('/dashboard/youtube/replies')) return ['YouTube Studio', 'Reply queue']
  if (pathname.startsWith('/dashboard/youtube')) return ['YouTube Studio']
  return ['Review center']
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3v-3H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

export default function DashboardHeader({
  workspaceName,
  plan,
  pathname,
  navigationOpen,
  assistantOpen,
  onNavigationToggle,
  onAssistantToggle,
}: Props) {
  const trail = pageTrail(pathname)

  return (
    <header className={styles.header}>
      <div className={styles.headerContext}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label={navigationOpen ? 'Close navigation' : 'Open navigation'}
          aria-controls="dashboard-navigation"
          aria-expanded={navigationOpen}
          onClick={onNavigationToggle}
        >
          <MenuIcon />
        </button>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <span className={styles.workspaceName}>{workspaceName}</span>
          {trail.map(item => (
            <span key={item} className={styles.breadcrumbItem}>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
              <span>{item}</span>
            </span>
          ))}
        </nav>
      </div>

      <div className={styles.headerActions}>
        <span className={styles.planLabel}>{PLAN_LABELS[plan]}</span>
        <button
          type="button"
          className={styles.assistantToggle}
          aria-label={assistantOpen ? 'Close Ask Replova' : 'Open Ask Replova'}
          aria-controls="ask-replova-panel"
          aria-expanded={assistantOpen}
          onClick={onAssistantToggle}
        >
          <span className={styles.assistantIcon}><AssistantIcon /></span>
          <span>Ask Replova</span>
        </button>
      </div>
    </header>
  )
}
