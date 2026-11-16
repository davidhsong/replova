import Link from 'next/link'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import styles from './DashboardShell.module.css'

type Props = {
  pathname: string
  workspaceName: string
  onClose: () => void
}

type SuggestedAction = {
  href: string
  label: string
  description: string
}

const DEFAULT_ACTIONS: SuggestedAction[] = [
  {
    href: '/dashboard/feedback-demo',
    label: 'Review feedback priorities',
    description: 'Open evidence-backed findings and improvement tasks.',
  },
  {
    href: '/dashboard',
    label: 'Work the review queue',
    description: 'Inspect drafts and approve replies explicitly.',
  },
  {
    href: '/dashboard/youtube/replies',
    label: 'Open YouTube replies',
    description: 'Review channel-specific drafts before publishing.',
  },
  {
    href: '/dashboard/settings',
    label: 'Manage integrations',
    description: 'Check connections, sync controls, and reply settings.',
  },
  {
    href: '/dashboard/competitors',
    label: 'Compare local performance',
    description: 'Review authorized competitive benchmarks.',
  },
]

const FEEDBACK_ACTIONS: SuggestedAction[] = [
  {
    href: '/dashboard/feedback-demo#feedback-trend',
    label: 'Review the feedback trend',
    description: 'Inspect six weeks of timestamped feedback volume.',
  },
  {
    href: '/dashboard/feedback-demo#feedback-priorities',
    label: 'Show improvement priorities',
    description: 'Jump to the three evidence-backed recommendations.',
  },
  {
    href: '/dashboard/feedback-demo#customer-recovery',
    label: 'View recovery queue',
    description: 'Open the customers who still need follow-up.',
  },
  {
    href: '/dashboard/feedback-demo#improvement-tasks',
    label: 'Navigate to action items',
    description: 'Review ownership, priority, and completion status.',
  },
]

const PLAYBOOK_ACTIONS: SuggestedAction[] = [
  {
    href: '/dashboard/playbook/demo',
    label: 'Open the synthetic Playbook',
    description: 'Practice the evidence, approval, version, and task workflow safely.',
  },
  {
    href: '/dashboard/feedback-demo',
    label: 'Inspect feedback evidence',
    description: 'Review the customer records behind operational patterns.',
  },
]

function currentLabel(pathname: string) {
  if (pathname.startsWith('/dashboard/playbook/demo')) return 'Synthetic Playbook demo'
  if (pathname.startsWith('/dashboard/playbook')) return 'Business Playbook'
  if (pathname.startsWith('/dashboard/feedback-demo')) return 'Feedback operations'
  if (pathname.startsWith('/dashboard/competitors')) return 'Competitor tracking'
  if (pathname.startsWith('/dashboard/review-requests')) return 'Review requests'
  if (pathname.startsWith('/dashboard/youtube')) return 'YouTube Studio'
  if (pathname.startsWith('/dashboard/billing')) return 'Billing'
  if (pathname.startsWith('/dashboard/settings')) return 'Settings'
  if (pathname.startsWith('/dashboard/applicants')) return 'Applicant tracking'
  return 'Review center'
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 6l4 4-4 4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  )
}

export default function AIAssistantPanel({ pathname, workspaceName, onClose }: Props) {
  const actions = pathname.startsWith('/dashboard/playbook')
    ? PLAYBOOK_ACTIONS
    : pathname.startsWith('/dashboard/feedback-demo') ? FEEDBACK_ACTIONS : DEFAULT_ACTIONS
  const suggestions = actions
    .filter(action => action.href !== pathname)
    .slice(0, 3)

  return (
    <aside className={styles.assistantPanel} aria-label="Ask Replova">
      <header className={styles.assistantHeader}>
        <div>
          <strong>Ask Replova</strong>
          <span>Guided workspace actions</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Ask Replova">
          <CloseIcon />
        </button>
      </header>

      <div className={styles.assistantBody}>
        <section className={styles.contextBlock}>
          <div>
            <span>Current context</span>
            <strong>{currentLabel(pathname)}</strong>
          </div>
          <p>{workspaceName}</p>
        </section>

        <section className={styles.suggestionBlock} aria-labelledby="ask-replova-suggestions">
          <div>
            <h2 id="ask-replova-suggestions">How can I help?</h2>
            <p>Choose an action grounded in the records and tools available on this page.</p>
          </div>
          <nav aria-label="Ask Replova suggestions">
            {suggestions.map(action => (
              <Link key={action.href} href={action.href}>
                <span className={styles.suggestionLogo} aria-hidden="true">
                  <ReplovaLogo variant="icon" surface="dark" height={13} decorative />
                </span>
                <span className={styles.suggestionCopy}>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </span>
                <ArrowIcon />
              </Link>
            ))}
          </nav>
        </section>
      </div>

      <footer className={styles.assistantFooter}>
        <span>Evidence-first actions</span>
        <p>
          Suggestions open existing authorized workflows. Replova does not publish or contact customers from this panel.
        </p>
      </footer>
    </aside>
  )
}
