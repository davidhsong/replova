import type { Metadata } from 'next'
import Link from 'next/link'
import InteractiveDashboardPreview from '@/components/marketing/InteractiveDashboardPreview'

export const metadata: Metadata = {
  title: 'Dashboard Preview',
  description: 'An interactive sample-data preview of the Replova operating dashboard.',
  robots: { index: false, follow: false },
}

export default function DashboardPreviewPage() {
  return (
    <main id="main-content" className="dash-preview-page">
      <div className="dash-preview-banner">
        <span><strong>Interactive sample dashboard.</strong> Every view uses synthetic data and cannot post, publish, or contact customers.</span>
        <Link href="/signin">Go to secure sign in</Link>
      </div>
      <InteractiveDashboardPreview variant="page" />
    </main>
  )
}
