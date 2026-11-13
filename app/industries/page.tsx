import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { industrySolutions } from '@/lib/industrySolutions'

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'Explore Google review response and reputation intelligence workflows tailored to the customer moments that matter in your business.',
  alternates: { canonical: '/industries' },
}

export default function SolutionsPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main">
        <section className="subpage-hero">
          <div className="t-eyebrow c-accent">Solutions</div>
          <h1>One review workflow. Tuned to your business.</h1>
          <p>The moments customers remember differ by category. Replova keeps the operating system consistent while adapting replies and insight to the way each business earns trust.</p>
          <div className="subpage-hero-actions">
            <Link href="/onboard" className="btn btn-primary btn-lg">Find my business <ArrowIcon /></Link>
            <Link href="/resources" className="btn btn-ghost btn-lg">Explore resources</Link>
          </div>
        </section>

        <div className="page-rule-heading">
          <h2>Business solutions</h2>
          <span>Six starting points · one adaptable platform</span>
        </div>
        <div className="resource-list solution-index-list">
          {industrySolutions.map((solution, index) => (
            <Link className="resource-article solution-index-row" href={`/industries/${solution.slug}`} key={solution.slug}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <div className="t-eyebrow">{solution.eyebrow}</div>
                <h2>{solution.name}</h2>
              </div>
              <div>
                <p>{solution.lede}</p>
                <div className="solution-index-meta">
                  <span>{solution.businesses.slice(0, 3).join(' · ')}</span>
                  <span className="solution-index-action">Explore solution <ArrowIcon /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section className="final-cta" style={{ marginTop: 92 }}>
          <div className="final-cta-inner">
            <div className="t-eyebrow">Your category is not a constraint.</div>
            <h2>Start with your Google listing.</h2>
            <p>Replova uses your actual business context—not a generic script pretending every customer is the same.</p>
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
