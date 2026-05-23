import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "AI Review Management for Med Spas & Aesthetic Clinics | Replova" },
  description:
    "Replova monitors your Google Business reviews and drafts AI reply suggestions for every new one. Post directly to Google in seconds. Built for med spas, aesthetic clinics, salons, and dental offices.",
  alternates: { canonical: "https://replova.app" },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Replova",
  url: "https://replova.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered reputation management for med spas, aesthetic clinics, salons, and dental offices. Get AI-drafted Google review replies, sentiment analysis, competitor tracking, and weekly digest emails.",
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: "79",
    highPrice: "349",
    offerCount: "3",
  },
  brand: {
    "@type": "Brand",
    name: "Replova",
  },
  publisher: {
    "@type": "Organization",
    name: "Replova",
    url: "https://replova.app",
    logo: {
      "@type": "ImageObject",
      url: "https://replova.app/replova-logo.png",
    },
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does AI reply generation work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a new Google review is detected, Replova sends it to Claude (Anthropic's AI) and generates three reply drafts — Professional, Warm, and Brief — written in your business's voice. You review the options, edit if needed, and post directly to Google in one click. Practice plan users can set a custom persona so every reply reflects their brand's exact tone.",
      },
    },
    {
      "@type": "Question",
      name: "Does Replova work with Google My Business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Replova connects directly to your Google Business Profile (formerly Google My Business) via Google's official API. Once you authorize your account, Replova automatically monitors for new reviews, syncs them in real time, and can post approved replies directly back to Google — no copy-pasting required.",
      },
    },
    {
      "@type": "Question",
      name: "How much does reputation management cost for a med spa?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Replova starts at $79/month for a single location (Solo plan), $179/month for up to 5 locations (Studio), and $349/month for up to 15 locations (Practice). All plans include a 30-day free trial with no credit card required and no setup fees.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Replova for multiple locations?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The Studio plan supports up to 5 locations and the Practice plan supports up to 15. Each location gets its own review monitoring, AI reply drafts, reputation score, and analytics. You can switch between locations from a single dashboard.",
      },
    },
  ],
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

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < rating ? 'var(--gold)' : 'none'}
          stroke={i < rating ? 'var(--gold)' : 'var(--line-md)'}
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  );
}

function HeroProductShot() {
  const faded = [
    { stars: 5, name: 'Sofia L.', t: 'Best facial I\'ve had in years.', time: 'Yesterday', op: 0.55 },
    { stars: 4, name: 'Marco R.', t: 'The HydraFacial was excellent.', time: 'Apr 19', op: 0.32 },
  ];

  return (
    <div className="card" style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-2)' }}>
      {/* Chrome */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Logo size={14} />
          <span style={{ color: 'var(--t4)', fontSize: 11 }}>/</span>
          <span className="t-xs c-t3">Reviews</span>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: '1px solid var(--line)' }}>
        <div style={{ padding: '14px 16px', borderRight: '1px solid var(--line)' }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="t-serif" style={{ fontSize: 28, lineHeight: 1, color: 'var(--t1)' }}>78</span>
            <span className="t-xs c-pos" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              4
            </span>
          </div>
        </div>
        <div style={{ padding: '14px 16px', borderRight: '1px solid var(--line)' }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>Rating</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="tnum" style={{ fontSize: 18, fontWeight: 600 }}>4.3</span>
            <Stars rating={4} size={11} />
          </div>
        </div>
        <div style={{ padding: '14px 16px' }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>Awaiting</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--neg)' }}>3</div>
        </div>
      </div>

      {/* Negative review */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 3, alignSelf: 'stretch', background: 'var(--neg)', borderRadius: 1, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>James K.</span>
              <Stars rating={2} size={11} />
              <span className="pill pill-neg">Urgent · 1-star</span>
            </div>
            <p className="t-serif t-italic" style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--t2)', margin: 0 }}>
              &ldquo;Wait time was much longer than expected and staff seemed rushed. We waited nearly an hour.&rdquo;
            </p>
          </div>
          <span className="t-xs c-t4" style={{ flexShrink: 0 }}>3h</span>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {['Professional', 'Warm', 'Brief'].map((l, i) => (
              <span key={l} style={{
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: i === 0 ? 'var(--surface)' : 'transparent',
                color: i === 0 ? 'var(--t1)' : 'var(--t3)',
                border: i === 0 ? '1px solid var(--line-md)' : '1px solid transparent',
              }}>{l}</span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, margin: 0 }}>
            Hi James — a longer wait and rushed service fall well below the standard we hold ourselves to. I&apos;d like the chance to make this right…
          </p>
        </div>
      </div>

      {/* Faded rows */}
      {faded.map((r, i) => (
        <div key={r.name} style={{ padding: '12px 16px', borderBottom: i === 0 ? '1px solid var(--line)' : 'none', display: 'flex', alignItems: 'center', gap: 12, opacity: r.op }}>
          <Stars rating={r.stars} size={11} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
            <span className="t-xs c-t3" style={{ marginLeft: 8 }}>{r.t}</span>
          </div>
          <span className="t-xs c-t4">{r.time}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--t1)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(250,249,246,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-nav-inner">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/signin" className="lp-signin" style={{ fontSize: 13, color: 'var(--t3)', padding: '6px 12px', textDecoration: 'none' }}>
              Sign in
            </a>
            <a href="/onboard" className="btn btn-primary btn-press" style={{ textDecoration: 'none' }}>
              Start free trial
            </a>
          </div>
        </div>
      </header>

      {/* Platform trust strip */}
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
        <div className="lp-strip-inner">
          <span className="t-xs c-t4" style={{ flexShrink: 0 }}>Works with</span>
          {[
            { name: 'Google Reviews', color: '#4285F4', status: 'Live' },
            { name: 'Yelp', color: '#d32323', status: 'Coming soon' },
            { name: 'Facebook', color: '#1877F2', status: 'Coming soon' },
          ].map(p => (
            <div
              key={p.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: p.status === 'Live' ? 1 : 0.55,
                flexShrink: 0,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                {p.name}
                <span style={{ color: 'var(--t4)', marginLeft: 4 }}>· {p.status}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="lp-hero">
        <div className="fade-up">
          <div className="t-eyebrow" style={{ marginBottom: 18 }}>Reputation management software for med spas &amp; aesthetic clinics</div>
          <h1 className="t-serif lp-h1">
            Reviews aren&apos;t<br />
            <span style={{ fontStyle: 'italic' }}>marketing.</span><br />
            They&apos;re the proof<br />
            before the visit.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 430, marginBottom: 28, lineHeight: 1.6 }}>
            Replova monitors your Google reviews, drafts replies in your voice, and surfaces what&apos;s actually driving your rating — which treatments clients love, which staff they name, and how you compare to nearby clinics.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a href="/onboard" className="btn btn-primary btn-lg btn-press" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Start free trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </a>
            <span className="t-xs c-t3">30 days · no card</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 24 }}>
            {[
              'AI reply drafts',
              'Treatment sentiment',
              'Staff shoutouts',
              'Competitor tracking',
              'Review campaigns',
              'Auto-reply',
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
        <div className="fade-up" style={{ animationDelay: '80ms' }}>
          <HeroProductShot />
        </div>
      </section>

      {/* Testimonials */}
      <section className="lp-section-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="lp-inner">
          <div className="lp-2up">
            <div>
              <div className="t-eyebrow c-accent">What clients say</div>
              <h2 className="t-serif lp-h2">
                Proof from the field.
              </h2>
            </div>
            <p style={{ alignSelf: 'end', maxWidth: 520, fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              Every result below comes from a real practice owner. Response rates, ratings, and hours saved — the numbers are theirs.
            </p>
          </div>

          <div className="lp-3col">
            {[
              {
                name: 'Dr. Amanda Chen',
                clinic: 'Lumière Aesthetics · Austin, TX',
                quote: 'We were sitting on 47 unanswered reviews. Within a week of using Replova, every single one had a reply. Our response rate went from 12% to 100%.',
                metric: '12% → 100% response rate',
              },
              {
                name: 'Kayla Morrison',
                clinic: 'The Studio Med Spa · Nashville, TN',
                quote: 'The sentiment breakdown showed us that clients kept mentioning wait times. We fixed the scheduling issue we didn\'t even know we had. Our rating went up half a star in two months.',
                metric: '4.3 → 4.8 in 60 days',
              },
              {
                name: 'Marcus Webb',
                clinic: 'Webb Dermatology Group · Phoenix, AZ',
                quote: 'I manage 6 locations. Before Replova I had one person whose entire job was reading and replying to reviews. That\'s now handled automatically every morning.',
                metric: '6 locations · 1 dashboard',
              },
            ].map(t => (
              <div key={t.name} style={{ background: 'var(--surface)', padding: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Stars rating={5} size={11} />
                <p style={{ marginTop: 16, fontSize: 15, fontStyle: 'italic', color: 'var(--t2)', lineHeight: 1.65, flexGrow: 1 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <span className="pill pill-pos" style={{ marginTop: 16, display: 'inline-block', fontSize: 11 }}>
                  {t.metric}
                </span>
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', display: 'block' }}>{t.name}</span>
                  <span className="t-xs c-t3" style={{ marginTop: 2, display: 'block' }}>{t.clinic}</span>
                  <span className="t-mono t-xs c-t4" style={{ marginTop: 6, display: 'block' }}>Verified customer</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Work */}
      <section className="lp-container">
        <div className="lp-2up">
          <div>
            <div className="t-eyebrow c-accent">The work</div>
            <h2 className="t-serif lp-h2">
              What you&apos;d do<br />if you had time.
            </h2>
          </div>
          <p style={{ fontSize: 16, color: 'var(--t2)', lineHeight: 1.7, alignSelf: 'end', maxWidth: 520 }}>
            Most practice owners write replies between appointments, after a long day, or never. Replova writes
            them in your voice the second a review lands — three options, each in a different register,
            ready for one tap.
          </p>
        </div>

        <div className="lp-3col">
          {[
            {
              n: '01', t: 'Reply',
              b: 'Three drafts per review — Professional, Warm, Brief. Edit and post to Google in one tap — or enable auto-reply and Replova posts instantly, 24/7.',
              ex: '"Hi James — a longer wait falls well below our standard. I\'d like the chance to make this right…" · auto-posted 4 min after review',
            },
            {
              n: '02', t: 'Read',
              b: 'A reputation score updated daily — rating, volume, response rate, and sentiment — broken down so you can see what moved it.',
              ex: '78 / 100 · Rating up · Sentiment flat · Response 91%',
            },
            {
              n: '03', t: 'Recover',
              b: 'Negative reviews surface first, with suggested recovery offers. Staff shoutouts roll up so you know who to thank.',
              ex: 'Marco · 9 mentions · "attentive without being intrusive"',
            },
          ].map(c => (
            <div key={c.n} style={{ background: 'var(--surface)', padding: 32 }}>
              <div className="t-mono c-accent" style={{ fontSize: 11, marginBottom: 18 }}>{c.n}</div>
              <h3 className="t-serif" style={{ fontSize: 28, marginBottom: 12, letterSpacing: '-0.01em' }}>{c.t}</h3>
              <p className="t-sm c-t2" style={{ marginBottom: 18, lineHeight: 1.65 }}>{c.b}</p>
              <div className="t-mono t-xs" style={{ color: 'var(--t3)', padding: 10, background: 'var(--surface-2)', borderRadius: 6, borderLeft: '2px solid var(--accent-line)' }}>
                {c.ex}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Built different */}
      <section className="lp-section-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div className="lp-inner">
          <div className="lp-2up">
            <div>
              <div className="t-eyebrow c-accent">Built different</div>
              <h2 className="t-serif lp-h2">
                Generic tools don&apos;t know what a HydraFacial is.
              </h2>
            </div>
            <p style={{ alignSelf: 'end', maxWidth: 520, fontSize: 16, color: 'var(--t2)', lineHeight: 1.7 }}>
              Replova is trained on aesthetic medicine. It reads treatment mentions, flags staff praise, and tells you exactly what&apos;s driving your rating — review by review.
            </p>
          </div>

          <div className="lp-2col">
            {[
              {
                key: 'treatment',
                icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
                eyebrow: 'Treatment intelligence',
                heading: 'Knows your menu.',
                body: 'Replova reads treatment mentions in every review — HydraFacial, Botox, laser, fillers — and tells you which services clients love and which generate complaints.',
                callout: 'HydraFacial · 14 mentions · 4.9 avg sentiment',
              },
              {
                key: 'staff',
                icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
                eyebrow: 'Staff intelligence',
                heading: 'Know who to thank.',
                body: 'Every staff mention across all reviews rolls up automatically. See which providers clients recommend by name — and which ones need a conversation.',
                callout: 'Maya · 23 mentions · "gentle and thorough"',
              },
              {
                key: 'competitive',
                icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
                eyebrow: 'Competitive radar',
                heading: 'See where you rank.',
                body: 'Track up to 10 nearby competitors. Their Google rating and review count update daily — so you know if a rival clinic is pulling ahead before your clients notice.',
                callout: 'You: 4.8 · Glow Aesthetics: 4.5 · Skin Studio: 4.3',
              },
              {
                key: 'campaigns',
                icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
                eyebrow: 'Review campaigns',
                heading: 'Ask at the right moment.',
                body: 'Send branded review request emails to past clients after their appointment. Upload a CSV, send individually, and track every open and click from one place.',
                callout: '42 sent · 31 opened · 8 new reviews this month',
              },
            ].map(cell => (
              <div key={cell.key} style={{ background: 'var(--surface)', padding: 32 }}>
                <div style={{ marginBottom: 0 }}>{cell.icon}</div>
                <div className="t-eyebrow" style={{ marginTop: 16, marginBottom: 10 }}>{cell.eyebrow}</div>
                <h3 className="t-serif" style={{ fontSize: 22, marginBottom: 10 }}>{cell.heading}</h3>
                <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.65, margin: 0 }}>{cell.body}</p>
                <div className="t-mono t-xs" style={{ color: 'var(--t3)', padding: 10, background: 'var(--surface-2)', borderRadius: 6, borderLeft: '2px solid var(--accent-line)', marginTop: 18 }}>
                  {cell.callout}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="lp-section-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div className="lp-inner">
          <div className="lp-2up" style={{ marginBottom: 40 }}>
            <div>
              <div className="t-eyebrow c-accent">Pricing</div>
              <h2 className="t-serif lp-pricing-h2">Three sizes,<br />one job.</h2>
            </div>
            <p style={{ alignSelf: 'end', maxWidth: 520, fontSize: 15, color: 'var(--t2)' }}>
              Same product, more locations. Cancel any time. Free for 30 days, no card.
            </p>
          </div>
          <div className="lp-plan-grid">
            {([
              {
                plan: 'Solo', planKey: 'starter', price: 79, locs: '1 location', comps: '3 competitor slots', best: 'Solo practices',
                features: ['AI reply drafts', 'Urgent alerts', 'Weekly digest', 'Review request campaigns'],
                highlight: false,
              },
              {
                plan: 'Studio', planKey: 'growth', price: 179, locs: '5 locations', comps: '5 competitor slots', best: 'Multi-location studios',
                features: ['Everything in Solo', 'Reputation score', 'Sentiment analysis', 'Competitor tracking', 'Monthly PDF report'],
                highlight: true,
              },
              {
                plan: 'Practice', planKey: 'agency', price: 349, locs: '15 locations', comps: '10 competitor slots', best: 'Groups & agencies',
                features: ['Everything in Studio', 'Custom reply persona', 'White-label PDF reports', 'Priority support'],
                highlight: false,
              },
            ] as const).map((p) => (
              <div key={p.plan} className="lp-plan-col" style={{
                padding: 32,
                background: p.highlight ? 'var(--bg)' : 'var(--surface)',
                position: 'relative',
              }}>
                {p.highlight && (
                  <div style={{ position: 'absolute', top: 14, right: 16 }}>
                    <span className="pill pill-accent">Most picked</span>
                  </div>
                )}
                <div className="t-eyebrow" style={{ color: p.highlight ? 'var(--accent)' : 'var(--t3)', marginBottom: 12 }}>{p.plan}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                  <span className="t-serif" style={{ fontSize: 48, lineHeight: 1 }}>${p.price}</span>
                  <span className="t-sm c-t3">/ month</span>
                </div>
                <div className="t-xs c-t3" style={{ marginBottom: 24 }}>{p.locs} · {p.comps}</div>
                <div className="t-xs" style={{ color: 'var(--t2)', marginBottom: 14, fontStyle: 'italic' }}>For: {p.best}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                      <span className="t-sm c-t2">{f}</span>
                    </div>
                  ))}
                </div>
                <a
                  href={`/onboard?plan=${p.planKey}`}
                  className={`btn ${p.highlight ? 'btn-primary' : 'btn-ghost'} btn-press`}
                  style={{ width: '100%', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Start with {p.plan}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Editorial CTA */}
      <section className="lp-cta-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="t-serif lp-cta-h2">
            Open the dashboard<br />before the first appointment.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 540, margin: '0 auto 32px' }}>
            Five minutes of setup. Thirty days free. After that, $79 a month — with treatment sentiment, competitor tracking, and staff analytics built in.
          </p>
          <a href="/onboard" className="btn btn-primary btn-lg btn-press" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Find my business
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section-pad" style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div className="t-eyebrow c-accent" style={{ marginBottom: 8 }}>FAQ</div>
          <h2 className="t-serif lp-faq-h2">
            Common questions.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              {
                q: 'How does AI reply generation work?',
                a: 'When a new Google review is detected, Replova sends it to Claude (Anthropic\'s AI) and generates three reply drafts — Professional, Warm, and Brief — written in your business\'s voice. You review the options, edit if needed, and post directly to Google in one click. Practice plan users can set a custom persona so every reply reflects their brand\'s exact tone.',
              },
              {
                q: 'Does Replova work with Google My Business?',
                a: 'Yes. Replova connects directly to your Google Business Profile (formerly Google My Business) via Google\'s official API. Once you authorize your account, Replova automatically monitors for new reviews, syncs them in real time, and can post approved replies directly back to Google — no copy-pasting required.',
              },
              {
                q: 'How much does reputation management cost for a med spa?',
                a: 'Replova starts at $79/month for a single location (Solo plan), $179/month for up to 5 locations (Studio), and $349/month for up to 15 locations (Practice). All plans include a 30-day free trial with no credit card required and no setup fees.',
              },
              {
                q: 'Can I use Replova for multiple locations?',
                a: 'Yes. The Studio plan supports up to 5 locations and the Practice plan supports up to 15. Each location gets its own review monitoring, AI reply drafts, reputation score, and analytics. You can switch between all locations from a single dashboard.',
              },
            ].map((item, i, arr) => (
              <div key={item.q} style={{ padding: '28px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none' }}>
                <h3 className="t-serif" style={{ fontSize: 20, fontWeight: 400, marginBottom: 10, letterSpacing: '-0.01em', color: 'var(--t1)' }}>
                  {item.q}
                </h3>
                <p style={{ fontSize: 15, color: 'var(--t2)', lineHeight: 1.7, margin: 0 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)', marginTop: 'auto' }}>
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
