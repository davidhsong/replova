import type { ReactNode } from 'react'
import Link from 'next/link'

export type LegalSection = { heading: string; content: ReactNode }

type Page = 'terms' | 'privacy' | 'refunds'

const TABS: { key: Page; label: string; href: string }[] = [
  { key: 'terms',   label: 'Terms',   href: '/terms'   },
  { key: 'privacy', label: 'Privacy', href: '/privacy' },
  { key: 'refunds', label: 'Refunds', href: '/refunds' },
]

function Logo() {
  return (
    <div style={{ width: 26, height: 26, background: 'var(--accent)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    </div>
  )
}

interface Props {
  page: Page
  title: string
  kicker: string
  sections: LegalSection[]
}

export default function LegalLayout({ page, title, kicker, sections }: Props) {
  const year = new Date().getFullYear()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </Link>
          <a href="/signin" style={{ fontSize: 13, color: 'var(--t3)', textDecoration: 'none' }}>Sign in</a>
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, maxWidth: 760, width: '100%', margin: '0 auto', padding: '72px 32px' }}>
        <div className="t-eyebrow" style={{ marginBottom: 14 }}>{kicker}</div>
        <h1 className="t-serif" style={{ fontSize: 56, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 18 }}>{title}</h1>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 16, paddingBottom: 32, borderBottom: '1px solid var(--line)' }}>
          {TABS.map(t => (
            <a key={t.key} href={t.href} style={{
              fontSize: 13,
              fontWeight: page === t.key ? 600 : 400,
              color: page === t.key ? 'var(--t1)' : 'var(--t3)',
              borderBottom: page === t.key ? '1px solid var(--t1)' : '1px solid transparent',
              paddingBottom: 6,
              textDecoration: 'none',
            }}>{t.label}</a>
          ))}
        </div>

        {/* Sections */}
        <div style={{ marginTop: 40 }}>
          {sections.map((s, i) => (
            <section key={i} style={{ marginBottom: 36, display: 'grid', gridTemplateColumns: '48px 1fr', gap: 24 }}>
              <div className="t-mono c-t4" style={{ fontSize: 11, paddingTop: 5 }}>
                §{(i + 1).toString().padStart(2, '0')}
              </div>
              <div>
                <h2 className="t-serif" style={{ fontSize: 22, lineHeight: 1.2, letterSpacing: '-0.01em', marginBottom: 10 }}>{s.heading}</h2>
                <div style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7 }}>
                  {s.content}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* Doc footer */}
        <div style={{ paddingTop: 32, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--t3)' }}>
          <span>Questions? <a href="mailto:support@replova.app" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>support@replova.app</a></span>
          <span>© {year} Replova</span>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '20px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t3)' }}>Replova</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <a href="/terms"   className="t-xs c-t4" style={{ textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Privacy</a>
            <a href="/refunds" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Refunds</a>
            <a href="mailto:support@replova.app" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Support</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
