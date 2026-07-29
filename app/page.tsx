import type { Metadata } from "next";
import Link from "next/link";
import WaitlistForm from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: { absolute: "Replova — Join the Waitlist" },
  description:
    "Replova is AI-powered reputation management for med spas, aesthetic clinics, salons, and dental offices. We're temporarily closed to new signups — join the waitlist to get early access when we reopen.",
  alternates: { canonical: "https://replova.app" },
};

export default function Home() {
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const serif = '"Times New Roman", Times, serif';

  return (
    <div style={{ fontFamily: serif, background: 'var(--bg)', color: 'var(--t1)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Title block */}
      <section style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
        <div className="fade-up" style={{ maxWidth: 520, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--t3)' }}>Replova</span>
          </Link>

          <h1 style={{ fontFamily: serif, fontSize: 34, fontWeight: 400, lineHeight: 1.3, margin: '20px 0 0' }}>
            A Short Break to Rebuild
          </h1>

          <hr style={{ width: 64, border: 0, borderTop: '1px solid var(--line-hi)', margin: '22px 0' }} />

          <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 420, marginBottom: 32, lineHeight: 1.7 }}>
            Replova is closed to new signups while we rebuild sign-in and billing.
            Leave your email and we&apos;ll let you know the moment we&apos;re back,
            plus give early access before anyone else.
          </p>

          <WaitlistForm />

          <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 28, lineHeight: 1.8 }}>
            AI reply drafts &middot; Treatment sentiment &middot; Staff shoutouts<br />
            Competitor tracking &middot; Review campaigns
          </p>

          <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 24 }}>{today}</p>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 24px', display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          <a href="/terms" style={{ fontSize: 12, color: 'var(--t4)', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ fontSize: 12, color: 'var(--t4)', textDecoration: 'none' }}>Privacy</a>
          <a href="/refunds" style={{ fontSize: 12, color: 'var(--t4)', textDecoration: 'none' }}>Refunds</a>
          <a href="mailto:support@replova.app" style={{ fontSize: 12, color: 'var(--t4)', textDecoration: 'none' }}>Support</a>
          <span style={{ fontSize: 12, color: 'var(--t4)' }}>&copy; {year} Replova</span>
        </div>
      </footer>
    </div>
  );
}
