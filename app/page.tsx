import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import WaitlistForm from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: { absolute: "Replova — Join the Waitlist" },
  description:
    "Replova is AI-powered reputation management for med spas, aesthetic clinics, salons, and dental offices. We're temporarily closed to new signups — join the waitlist to get early access when we reopen.",
  alternates: { canonical: "https://replova.app" },
};

function Logo({ size = 20 }: { size?: number }) {
  const box = size + 6;
  return (
    <Image
      src="/replova-logo.png"
      alt="Replova"
      width={box}
      height={box}
      style={{ borderRadius: Math.round(box * 0.35), flexShrink: 0 }}
    />
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--t1)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--line)' }}>
        <div className="lp-nav-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </Link>
          <span className="pill pill-warn">Temporarily closed to new signups</span>
        </div>
      </header>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
        <div className="fade-up" style={{ maxWidth: 560, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="t-eyebrow" style={{ marginBottom: 18 }}>Reputation management for med spas &amp; aesthetic clinics</div>
          <h1 className="t-serif" style={{ fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 18 }}>
            We&apos;re taking a short break<br />to rebuild.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 460, marginBottom: 32, lineHeight: 1.6 }}>
            Replova is closed to new signups while we rebuild sign-in and billing. Leave your email and we&apos;ll let you know the moment we&apos;re back, plus give early access before anyone else.
          </p>
          <WaitlistForm />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 28 }}>
            {[
              'AI reply drafts',
              'Treatment sentiment',
              'Staff shoutouts',
              'Competitor tracking',
              'Review campaigns',
            ].map(f => (
              <span
                key={f}
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--t3)',
                  padding: '4px 10px',
                  border: '1px solid var(--line-md)',
                  borderRadius: 100,
                  background: 'var(--surface)',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="lp-footer-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={14} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t3)' }}>Replova</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <a href="/terms" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Terms</a>
            <a href="/privacy" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Privacy</a>
            <a href="/refunds" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Refunds</a>
            <a href="mailto:support@replova.app" className="t-xs c-t4" style={{ textDecoration: 'none' }}>Support</a>
            <span className="t-xs c-t4">© {year} Replova</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
