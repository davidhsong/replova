import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader, NavItemIcon } from '@/components/MarketingChrome'
import { AnimatedStoryBarChart } from '@/components/marketing/AnimatedStoryBarChart'
import InteractiveDashboardPreview from '@/components/marketing/InteractiveDashboardPreview'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { ProductShowcase } from '@/components/marketing/ProductShowcase'
import { PromiseWorkflowVisual } from '@/components/marketing/PromiseWorkflowVisual'
import { ResearchProof } from '@/components/marketing/ResearchProof'
import finalCtaPreview from '@/public/product-showcase/review-intelligence.png'
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
        url: `${SITE_URL}/brand/social/logo-social.png`,
        width: 1024,
        height: 1024,
      },
      description: 'First-party feedback and issue Playbooks for local businesses.',
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

const industries = [
  { name: 'Healthcare & wellness', note: 'Surface patient experience themes while keeping every public reply thoughtful.', href: '/industries/healthcare-wellness', icon: 'healthcare' },
  { name: 'Home services', note: 'Track communication, punctuality, craftsmanship, and recurring service gaps.', href: '/industries/home-services', icon: 'home' },
  { name: 'Automotive', note: 'Understand trust, estimates, wait times, repair quality, and advisor shoutouts.', href: '/industries/automotive', icon: 'automotive' },
  { name: 'Professional services', note: 'Turn client feedback into specific improvements across every office.', href: '/industries/professional-services', icon: 'professional' },
  { name: 'Retail & hospitality', note: 'Spot location-level trends in service, products, atmosphere, and value.', href: '/industries/retail-hospitality', icon: 'retail' },
  { name: 'Any local business', note: 'If customers review you on Google, Replova can support the feedback loop.', href: '/industries/local-businesses', icon: 'local' },
] as const

function ProductPreview() {
  return <InteractiveDashboardPreview defaultAssistantOpen />
}

function SessionAccessIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30" fill="none">
      <path d="M12 2.75 19 5.8v5.45c0 4.48-2.78 8.13-7 9.95-4.22-1.82-7-5.47-7-9.95V5.8l7-3.05Z" />
      <circle cx="12" cy="10.15" r="1.6" />
      <path d="M12 11.75v3.1" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28">
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48Z" />
    </svg>
  )
}

function OpenAIIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729Zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944Zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464ZM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872Zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667Zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66ZM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813Zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  )
}

function DataControlIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="30" height="30" fill="none">
      <ellipse cx="11.5" cy="5.5" rx="7.25" ry="2.75" />
      <path d="M4.25 5.5v5c0 1.52 3.25 2.75 7.25 2.75s7.25-1.23 7.25-2.75v-5" />
      <path d="M4.25 10.5v5c0 1.52 3.25 2.75 7.25 2.75 1.08 0 2.1-.09 3-.27" />
      <path d="m15.6 17.15 1.55 1.55 3.15-3.65" />
    </svg>
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
      <AnimatedStoryBarChart />
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

          <h1><span>Turn feedback</span><span>into action.</span></h1>
          <p>Customers tap or scan, rate their visit, and leave a comment. See which issues keep coming up and use a Playbook to track the fix.</p>
          <div className="hero-actions hero-actions-centered">
            <Link href="/demo" className="btn btn-primary btn-lg">Book a demo</Link>
            <Link href="/dashboard-preview#sample-issue" className="btn btn-quiet btn-lg">Preview sample feedback</Link>
          </div>
          <div className="tap-preview" aria-label="Sample feedback workflow">
            <div className="tap-preview-placard"><small>Sample placard</small><strong>How was <br/>your visit?</strong><span>Tap or scan to leave feedback</span></div>
            <div className="tap-preview-issue"><small>Sample quarterly Playbook</small><h2>Pests and hygiene</h2><p>70 of 150 submissions</p><meter aria-label="Sample mentions" min="0" max="150" value="70" /><details><summary>See the evidence and next step</summary><p>“We saw insects near the entrance.”</p><p>Log the affected area and request a written inspection quote.</p></details></div>
          </div>
        </section>

        <ResearchProof />

        <section id="tap-workflow" className="proof-section" aria-label="Platform capabilities">
          <div className="lp-inner">
            <h2 className="proof-title">From the counter to the next action</h2>
            <div className="proof-cards pilot-story">
              <article><strong>Tap</strong><p>Give each location a placard with one link for NFC and QR.</p></article>
              <article><strong>Feedback</strong><p>Read private comments and see how many visits mention each issue.</p></article>
              <article><strong>Playbooks</strong><p>Log the problem, coordinate a fix and check whether it worked.</p></article>
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

        <details className="lp-container legacy-preview"><summary>Explore the sample review dashboard</summary><ProductPreview /></details>
        <ProductShowcase />

        <section className="promise-section">
          <div className="lp-inner promise-card">
            <div>
              <div className="t-eyebrow">Our promise</div>
              <h2>You set the limits.</h2>
              <p>Inspect the evidence, set a service window and budget, and pause a Playbook whenever you need to.</p>
              <span>Human-controlled by default</span>
            </div>
            <PromiseWorkflowVisual />
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
                <div className="industry-card-heading">
                  <span><NavItemIcon name={industry.icon} /><h3>{industry.name}</h3></span>
                  <ArrowIcon diagonal />
                </div>
                <p>{industry.note}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="security-section">
          <div className="lp-inner security-card">
            <div className="section-intro"><div className="t-eyebrow">Security by design</div><h2>Your customer feedback stays protected.</h2><p>Security choices are built into the workflow instead of added as an afterthought.</p></div>
            <div className="security-grid">
              <article><span className="security-icon security-icon-stroke"><SessionAccessIcon /></span><strong>Session-based access</strong><p>Passwordless sign-in and server-side authorization checks.</p></article>
              <article><span className="security-icon security-icon-brand"><GoogleIcon /></span><strong>Scoped Google connection</strong><p>OAuth is used for Business Profile access, never as Replova login.</p></article>
              <article><span className="security-icon security-icon-brand"><OpenAIIcon /></span><strong>Non-persistent AI requests</strong><p>Replova asks OpenAI not to store generated response payloads.</p></article>
              <article><span className="security-icon security-icon-stroke"><DataControlIcon /></span><strong>Data control</strong><p>Disconnect Google or delete account data from Settings.</p></article>
            </div>
          </div>
        </section>

        <HomeFaq />

        <section className="final-cta">
          <div className="final-cta-inner">
            <div className="final-cta-copy">
              <h2>See Replova in action.</h2>
              <p>Discover where customer feedback can improve your business with a demo focused on your review workflow.</p>
              <Link href="/demo" className="btn btn-primary btn-lg">Request a demo</Link>
            </div>
            <div className="final-cta-visual" aria-hidden="true">
              <div className="final-cta-preview">
                <Image
                  src={finalCtaPreview}
                  alt=""
                  fill
                  sizes="(max-width: 900px) calc(100vw - 56px), 660px"
                  quality={92}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
