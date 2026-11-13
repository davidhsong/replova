import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { createPageMetadata, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: '/',
  absoluteTitle: true,
})

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Replova',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/replova-logo.png`,
        width: 1254,
        height: 1254,
      },
      description: 'AI-powered B2B SaaS for review management, customer feedback analysis, and actionable business insights.',
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Replova',
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en-US',
    },
  ],
}

const plans = [
  {
    name: 'Starter', key: 'starter', price: 39, description: 'The essentials for one business location.',
    features: ['1 location', '3 AI reply styles', 'Urgent review alerts', 'Weekly digest'], featured: false,
  },
  {
    name: 'Growth', key: 'growth', price: 99, description: 'Deeper intelligence for growing local brands.',
    features: ['Up to 5 locations', 'Reputation and sentiment scores', '5 competitors per location', 'Priority review monitoring'], featured: true,
  },
  {
    name: 'Agency', key: 'agency', price: 199, description: 'Advanced control for larger, multi-location teams.',
    features: ['Up to 15 locations', 'Custom reply persona', '10 competitors per location', 'Multi-location oversight'], featured: false,
  },
] as const

const industries = [
  { name: 'Healthcare & wellness', note: 'Surface patient experience themes while keeping every public reply thoughtful.', href: '/industries/healthcare-wellness', icon: '✦' },
  { name: 'Home services', note: 'Track communication, punctuality, craftsmanship, and recurring service gaps.', href: '/industries/home-services', icon: '⌂' },
  { name: 'Automotive', note: 'Understand trust, estimates, wait times, repair quality, and advisor shoutouts.', href: '/industries/automotive', icon: '◇' },
  { name: 'Professional services', note: 'Turn client feedback into specific improvements across every office.', href: '/industries/professional-services', icon: '□' },
  { name: 'Retail & hospitality', note: 'Spot location-level trends in service, products, atmosphere, and value.', href: '/industries/retail-hospitality', icon: '○' },
  { name: 'Any local business', note: 'If customers review you on Google, Replova can support the feedback loop.', href: '/industries/local-businesses', icon: '↗' },
] as const

const faqs = [
  ['Who is Replova built for?', 'Any business with a Google Business Profile, from a single local shop to a multi-location operator or agency.'],
  ['Does Replova post replies automatically?', 'It can, but you stay in control. Review three draft styles, publish manually, or enable delayed auto-reply with safeguards in Settings.'],
  ['How does the AI learn our voice?', 'Every plan gets professional, warm, and brief drafts. Agency teams can add a custom reply persona for more specific brand guidance.'],
  ['What happens when a low rating arrives?', 'Replova flags it as urgent and can email the owner with the review and a suggested response based on the configured threshold.'],
  ['Can I cancel or change plans?', 'Yes. Billing is managed through Stripe, and you can change or cancel from the Billing page.'],
] as const

function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Preview of the Replova review dashboard">
      <div className="preview-topbar">
        <div><span className="preview-kicker">Review center</span><strong>Northstar Auto Care</strong></div>
        <span className="preview-status"><i /> Monitoring</span>
      </div>
      <div className="preview-stats">
        <div><span>Replova score</span><strong>86</strong><small>+4.2 this week</small></div>
        <div><span>Google rating</span><strong>4.7</strong><small>Last 90 days</small></div>
        <div><span>Awaiting reply</span><strong className="preview-alert">3</strong><small>Needs attention</small></div>
      </div>
      <div className="preview-workspace">
        <div className="preview-inbox">
          <div className="preview-tabs"><strong>Awaiting reply</strong><span>Replied</span><span>All</span></div>
          <article className="preview-review preview-review-active">
            <div className="preview-review-head">
              <div><strong>Marcus T.</strong><span>2.0 / 5</span></div>
              <span className="pill pill-neg">Urgent</span>
            </div>
            <p>The repair was done well, but I waited almost forty minutes past the pickup time and no one called with an update.</p>
            <div className="preview-draft">
              <div><strong>Professional</strong><span>Warm</span><span>Brief</span></div>
              <p>Hi Marcus, I&apos;m glad the repair went well, but I&apos;m sorry we missed your pickup time and did not keep you updated.</p>
              <button type="button" tabIndex={-1}>Post reply</button>
            </div>
          </article>
          <article className="preview-review">
            <div className="preview-review-head"><div><strong>Elena V.</strong><span>5.0 / 5</span></div><small>2h ago</small></div>
            <p>Maya explained every option clearly and never pressured me into extra work.</p>
          </article>
        </div>
        <aside className="preview-intel">
          <span>Reputation intelligence</span>
          <div className="preview-score"><strong>86</strong><small>/ 100</small></div>
          <div className="preview-meter"><i /></div>
          <dl>
            <div><dt>Response rate</dt><dd>94%</dd></div>
            <div><dt>Sentiment</dt><dd className="positive">Positive</dd></div>
          </dl>
          <span className="preview-label">Top themes</span>
          <div className="preview-themes"><i>service</i><i>communication</i><i>wait time</i></div>
        </aside>
      </div>
    </div>
  )
}

function ReplyStoryCard() {
  return (
    <article className="story-card story-card-violet">
      <div className="story-visual">
        <div className="story-review"><span>NEW REVIEW · 2 STARS</span><p>Service was solid, but nobody called when the timeline changed.</p></div>
        <div className="story-reply"><span>WARM DRAFT</span><p>You deserved a clear update. We&apos;re sorry we left you waiting, and we&apos;re fixing that handoff.</p></div>
      </div>
      <h3>Respond like a human</h3>
      <p>Generate three context-aware drafts, choose the right tone, and publish to Google without tab hopping.</p>
    </article>
  )
}

function InsightStoryCard() {
  return (
    <article className="story-card story-card-blue">
      <div className="story-visual story-chart">
        <div><span>Sentiment trend</span><strong>+12%</strong></div>
        <div className="story-bars"><i /><i /><i /><i /><i /><i /></div>
        <small>Communication improved after the new handoff process.</small>
      </div>
      <h3>Find the pattern behind the rating</h3>
      <p>See recurring topics, sentiment movement, staff shoutouts, and nearby competitors in one clear view.</p>
    </article>
  )
}

export default function Home() {
  return (
    <div className="marketing-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <MarketingHeader />
      <main id="main-content">
        <section className="lp-hero-centered">
          <Link href="/industries" className="hero-announcement">Now built for every local business <ArrowIcon /></Link>
          <h1>Turn every review into your next advantage.</h1>
          <p>Replova answers Google reviews in your voice, keeps the response workflow moving, and shows what paying customers are really telling you.</p>
          <div className="hero-actions hero-actions-centered">
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
            <Link href="#platform" className="text-link">Explore the platform</Link>
          </div>
          <div className="hero-note hero-note-centered"><span>45-minute product walkthrough</span><span>See the complete workflow</span></div>
          <div className="hero-product hero-product-wide fade-up"><ProductPreview /></div>
        </section>

        <section className="proof-section" aria-label="Platform capabilities">
          <div className="lp-inner">
            <p className="proof-title">A complete review workflow, without another full-time inbox</p>
            <div className="proof-cards">
              <article><span>01</span><strong>Automatic monitoring</strong><p>Sync new Google reviews on a six-hour cadence.</p></article>
              <article><span>02</span><strong>Replies ready to review</strong><p>Professional, warm, and brief drafts for every rating.</p></article>
              <article><span>03</span><strong>Signals you can use</strong><p>Turn comments into themes, trends, alerts, and actions.</p></article>
              <article><span>04</span><strong>One place to act</strong><p>Approve replies, publish to Google, and compare performance.</p></article>
            </div>
            <div className="industry-wordmarks" aria-label="Business types supported">
              <span>Healthcare</span><span>Home services</span><span>Automotive</span><span>Retail</span><span>Hospitality</span><span>Professional services</span>
            </div>
          </div>
        </section>

        <section id="platform" className="lp-container story-section">
          <div className="section-intro">
            <div className="t-eyebrow c-accent">How Replova works</div>
            <h2>Understand every review.<br />Know what to improve.</h2>
          </div>
          <div className="story-grid"><ReplyStoryCard /><InsightStoryCard /></div>
        </section>

        <section id="intelligence" className="platform-explore">
          <div className="lp-inner">
            <div className="section-intro section-intro-split">
              <div><div className="t-eyebrow">Explore the platform</div><h2>Put customer feedback to work.</h2></div>
              <p>A single operating view for the public conversation around your business—what needs a reply, what needs attention, and what is changing.</p>
            </div>
            <div className="platform-stage">
              <div className="platform-copy">
                <span className="platform-tab">Reputation intelligence</span>
                <h3>Ask better questions of your reviews.</h3>
                <p>See where response rate is slipping, which themes repeat, and which team members customers remember for the right reasons.</p>
                <Link href="/demo" className="btn btn-primary">Request a demo <ArrowIcon /></Link>
              </div>
              <div className="insight-sheet">
                <div className="insight-head"><span>Weekly intelligence</span><small>Oct 26 - Nov 1</small></div>
                <div className="insight-score"><span>Reputation score</span><strong>86.4</strong><em>+4.2</em></div>
                <div className="insight-row"><span>What customers loved</span><p>Maya&apos;s explanations, transparent pricing, repair quality</p></div>
                <div className="insight-row"><span>Needs attention</span><p>Friday wait times and pickup communication</p></div>
                <div className="insight-row"><span>Recommended action</span><p>Send a status update when a promised pickup time changes by 15 minutes.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="promise-section">
          <div className="lp-inner promise-card">
            <div>
              <div className="t-eyebrow">Our promise</div>
              <h2>Automation that still sounds like you.</h2>
              <p>Replova handles the repetitive work while keeping judgment where it belongs—with the people responsible for the customer relationship.</p>
              <span>Human-controlled by default</span>
            </div>
            <div className="promise-visual" aria-hidden="true">
              <div><small>Customer review</small><p>“They explained the options clearly and finished ahead of schedule.”</p></div>
              <i />
              <div><small>Replova draft</small><p>“Thank you for trusting our team. We&apos;re glad the options felt clear and the early finish made your day easier.”</p></div>
            </div>
          </div>
        </section>

        <section className="lp-container industries-section">
          <div className="section-intro">
            <div className="t-eyebrow c-accent">Solutions</div>
            <h2>Built for the way your business earns trust.</h2>
          </div>
          <div className="industry-grid">
            {industries.map(industry => (
              <Link href={industry.href} key={industry.name} className="industry-card">
                <div><span>{industry.icon}</span><ArrowIcon diagonal /></div>
                <h3>{industry.name}</h3><p>{industry.note}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="security-section">
          <div className="lp-inner security-card">
            <div className="section-intro"><div className="t-eyebrow">Security by design</div><h2>Your customer feedback stays protected.</h2><p>Security choices are built into the workflow instead of added as an afterthought.</p></div>
            <div className="security-grid">
              <article><strong>Session-based access</strong><p>Passwordless sign-in and server-side authorization checks.</p></article>
              <article><strong>Scoped Google connection</strong><p>OAuth is used for Business Profile access, never as Replova login.</p></article>
              <article><strong>Non-persistent AI requests</strong><p>Replova asks OpenAI not to store generated response payloads.</p></article>
              <article><strong>Data control</strong><p>Disconnect Google or delete account data from Settings.</p></article>
            </div>
          </div>
        </section>

        <section className="lp-container faq-section">
          <div className="section-intro"><div className="t-eyebrow c-accent">FAQ</div><h2>A few things worth knowing.</h2></div>
          <div className="faq-grid">
            {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}
          </div>
        </section>

        <section id="pricing" className="lp-container pricing-section">
          <div className="pricing-heading">
            <div><div className="t-eyebrow c-accent">Pricing</div><h2 className="lp-pricing-h2">Start with one location. Scale when you are ready.</h2></div>
            <p>Every plan includes AI reply drafts, urgent review alerts, Google review monitoring, and weekly digests.</p>
          </div>
          <div className="lp-plan-grid">
            {plans.map(plan => (
              <article key={plan.key} className={`lp-plan-col plan-card${plan.featured ? ' plan-card-featured' : ''}`}>
                <div className="plan-topline"><span className="t-eyebrow">{plan.name}</span>{plan.featured && <span className="pill pill-accent">Most popular</span>}</div>
                <div className="plan-price"><strong>${plan.price}</strong><span>/ month</span></div>
                <p>{plan.description}</p>
                <ul>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
                <Link href={`/onboard?plan=${plan.key}`} className={`btn btn-block ${plan.featured ? 'btn-primary' : 'btn-ghost'}`}>Choose {plan.name}</Link>
              </article>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div className="final-cta-inner">
            <div className="t-eyebrow">Your reviews are already telling you what to fix.</div>
            <h2>See Replova in action.</h2>
            <p>Find your business, connect Google, and make the next review easier to act on.</p>
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
