import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'AI Review Management for Med Spas & Aesthetic Clinics | Replova' },
  description: 'Monitor Google reviews, draft thoughtful replies, track treatment sentiment, and understand your clinic’s reputation with Replova.',
  alternates: { canonical: 'https://replova.app' },
}

const plans = [
  { name: 'Starter', key: 'starter', price: 39, description: 'For one location, with the core review tools', featured: false },
  { name: 'Growth', key: 'growth', price: 99, description: 'For up to five locations, with tracking and reports', featured: true },
  { name: 'Agency', key: 'agency', price: 199, description: 'For up to 15 locations, with custom branding', featured: false },
] as const

function Logo() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Image src="/replova-logo.png" alt="" width={26} height={26} style={{ borderRadius: 9 }} />
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>Replova</span>
    </span>
  )
}

export default function Home() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--t1)' }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="lp-nav-inner">
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}><Logo /></Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 8 }} aria-label="Account">
            <Link href="/signin" className="btn btn-quiet" style={{ textDecoration: 'none' }}>Sign in</Link>
            <Link href="/onboard" className="btn btn-primary btn-press" style={{ textDecoration: 'none' }}>Start free trial</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-hero" style={{ alignItems: 'center' }}>
          <div className="fade-up">
            <div className="t-eyebrow c-accent" style={{ marginBottom: 18 }}>Google review management for med spas and aesthetic clinics</div>
            <h1 className="t-serif lp-h1">Stay on top of every Google review.</h1>
            <p style={{ maxWidth: 560, margin: '22px 0 28px', fontSize: 17, lineHeight: 1.7, color: 'var(--t2)' }}>
              Replova checks for new Google reviews, drafts three replies in your preferred tone, flags low ratings, and tracks what clients say about your treatments and staff.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/onboard" className="btn btn-primary btn-lg btn-press" style={{ textDecoration: 'none' }}>Find my business</Link>
              <span className="t-xs c-t3">30-day free trial · cancel anytime</span>
            </div>
          </div>

          <div className="card fade-up" style={{ padding: 28, boxShadow: 'var(--shadow-2)' }}>
            <div className="t-eyebrow" style={{ marginBottom: 16 }}>Everything in one review inbox</div>
            {[
              ['Reply drafts', 'Choose a professional, warm, or brief reply, then edit it as needed.'],
              ['Review trends', 'See your daily score, common topics, and staff mentions.'],
              ['Direct Google replies', 'Review, edit, and publish a response from Replova.'],
              ['Competitor tracking', 'Compare your rating with nearby clinics.'],
            ].map(([title, copy], index) => (
              <div key={title} style={{ padding: '16px 0', borderTop: index ? '1px solid var(--line)' : 'none' }}>
                <div style={{ fontSize: 14, fontWeight: 650, marginBottom: 4 }}>{title}</div>
                <div className="t-sm c-t3" style={{ lineHeight: 1.55 }}>{copy}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
          <div className="lp-inner">
            <div style={{ maxWidth: 620, marginBottom: 36 }}>
              <div className="t-eyebrow c-accent">Simple pricing</div>
              <h2 className="t-serif lp-h2">Choose the plan that fits your locations.</h2>
              <p className="t-sm c-t2">Every plan includes reply drafts, low-rating alerts, weekly reports, and review request emails.</p>
            </div>
            <div className="lp-plan-grid">
              {plans.map(plan => (
                <article key={plan.key} className="lp-plan-col" style={{ padding: 28, background: plan.featured ? 'var(--bg)' : 'var(--surface)', position: 'relative' }}>
                  {plan.featured && <span className="pill pill-accent" style={{ position: 'absolute', top: 16, right: 16 }}>Most popular</span>}
                  <div className="t-eyebrow" style={{ marginBottom: 12 }}>{plan.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span className="t-serif" style={{ fontSize: 46 }}>${plan.price}</span>
                    <span className="t-sm c-t3">/ month</span>
                  </div>
                  <p className="t-sm c-t2" style={{ minHeight: 42 }}>{plan.description}</p>
                  <Link href={`/onboard?plan=${plan.key}`} className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} btn-block`} style={{ textDecoration: 'none', marginTop: 20 }}>
                    Choose {plan.name}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="lp-footer-inner">
          <Logo />
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <Link href="/terms" className="t-xs c-t4">Terms</Link>
            <Link href="/privacy" className="t-xs c-t4">Privacy</Link>
            <Link href="/refunds" className="t-xs c-t4">Refunds</Link>
            <a href="mailto:support@replova.app" className="t-xs c-t4">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
