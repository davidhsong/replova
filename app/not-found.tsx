import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page Not Found',
}

function Logo({ size = 20 }: { size?: number }) {
  const box = size + 6
  return (
    <Image
      src="/replova-logo.png"
      alt="Replova"
      width={box}
      height={box}
      style={{ borderRadius: Math.round(box * 0.35), flexShrink: 0 }}
    />
  )
}

export default function NotFound() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="fade-up" style={{ textAlign: 'center', maxWidth: 400 }}>
          <p className="t-mono c-t4" style={{ fontSize: 13, marginBottom: 8 }}>Error 404</p>
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
          <span className="t-xs c-t4">© {new Date().getFullYear()} Replova</span>
        </div>
      </footer>
    </div>
  )
}
