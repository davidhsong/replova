import type { Metadata } from 'next'
import Link from 'next/link'
import InteractiveDashboardPreview from '@/components/marketing/InteractiveDashboardPreview'

export const metadata: Metadata = {
  title: 'Dashboard Preview',
  description: 'Explore a fictional location’s feedback and a sample service-business dashboard.',
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
          <p>Riverside branch · July to September</p>
        </header>
        <details className="issue-bar">
          <summary>
            Pests and hygiene · 70 of 150 submissions
            <meter min="0" max="150" value="70" />
          </summary>
          <p>Sample comment: “We saw insects near the entrance.”</p>
          <p>Next action: log the affected areas and compare pest-control providers.</p>
        </details>
      </section>
      <InteractiveDashboardPreview variant="page" />
    </main>
  )
}
