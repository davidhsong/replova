import type { Metadata } from 'next'
import Link from 'next/link'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' }}>
          <Link href="/" aria-label="Replova home" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <ReplovaLogo variant="primary" surface="light" height={24} decorative eager />
          </Link>
        </div>
      </header>

      <main id="main-content" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: 400 }}>
          <p className="t-mono c-t2" style={{ fontSize: 13, marginBottom: 8 }}>Error 404</p>
          <h1 className="t-serif" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 14 }}>
            We couldn&apos;t find<br />that page.
          </h1>
          <p className="t-sm c-t2" style={{ marginBottom: 28, lineHeight: 1.6 }}>
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>
          <Link href="/" className="btn btn-primary btn-press" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            Go home
          </Link>
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '20px 32px', textAlign: 'center' }}>
          <span className="t-xs c-t2">© {new Date().getFullYear()} Replova</span>
        </div>
      </footer>
    </div>
  )
}
