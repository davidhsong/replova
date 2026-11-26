import type { Metadata } from 'next'
import Link from 'next/link'
import { createPageMetadata } from '@/lib/seo'
import InteractiveDashboardPreview from '@/components/marketing/InteractiveDashboardPreview'

export const metadata: Metadata = {
  ...createPageMetadata({
    title: 'Dashboard Preview',
    description: 'Explore a fictional location’s feedback and a sample service-business dashboard.',
    path: '/dashboard-preview',
  }),
  robots: { index: false, follow: false },
}

export default function DashboardPreviewPage() {
  return (
    <main id="main-content" className="dash-preview-page">
      <div className="dash-preview-banner">
        <span>
          <strong>Interactive sample dashboard.</strong>{' '}
          Every view uses synthetic data and cannot post, publish, or contact customers.
        </span>
        <Link href="/signin">Go to secure sign in</Link>
      </div>
      <section className="pilot sample" id="sample-issue">
        <header>
          <small>Sample feedback · Fictional location</small>
          <h1>What needs attention</h1>
          <p>Northstar Auto Care · Riverside branch · July to September</p>
        </header>
        <details className="issue-bar">
          <summary>
            After-hours drop-off · 2 of 12 submissions
            <meter min="0" max="12" value="2" />
          </summary>
          <p>Sample comment: “I found the key box, but I couldn’t tell where to leave my car.”</p>
          <a href="?view=tasks#preview-dashboard-content">Open the parking Playbook action</a>
          <p>Next action: mark the overnight parking spaces and update the drop-off instructions.</p>
        </details>
      </section>
      <InteractiveDashboardPreview variant="page" />
    </main>
  )
}
