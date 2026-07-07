'use client'

import Image from 'next/image'
import Link from 'next/link'

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

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
          <p className="t-mono c-t4" style={{ fontSize: 13, marginBottom: 8 }}>Error 500</p>
          <h1 className="t-serif" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 14 }}>
            Something<br /><span style={{ fontStyle: 'italic', color: 'var(--t3)' }}>broke.</span>
          </h1>
          <p className="t-sm c-t2" style={{ marginBottom: 28, lineHeight: 1.6 }}>
            An unexpected error occurred. Try again, or head back home.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button onClick={reset} className="btn btn-primary btn-press">
              Try again
            </button>
            <Link href="/" className="btn btn-ghost btn-press" style={{ textDecoration: 'none' }}>
              Go home
            </Link>
          </div>
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
