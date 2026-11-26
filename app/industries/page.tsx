import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { industrySolutions } from '@/lib/industrySolutions'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Industries',
  description: 'Explore examples of private Tap feedback across industries, from appointment check-in to repair estimates and retail returns.',
  path: '/industries',
})

export default function SolutionsPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main">
        <section className="subpage-hero">
          <div className="t-eyebrow c-accent">Industries</div>
          <h1>What do customers notice during a visit?</h1>
          <p>A customer taps or scans your placard to leave a private rating and optional comment. Choose an example below to see what that feedback could tell you.</p>
          <div className="subpage-hero-actions">
            <Link href="/onboard" className="btn btn-primary btn-lg">Create a workspace <ArrowIcon /></Link>
            <Link href="/resources" className="btn btn-ghost btn-lg">Explore resources</Link>
          </div>
        </section>

        <div className="page-rule-heading">
          <h2>Explore industries</h2>
          <span>Three groups and a specialty example</span>
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
                  <span className="solution-index-action">Explore industry <ArrowIcon /></span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section className="final-cta" style={{ marginTop: 92 }}>
          <div className="final-cta-inner">
            <h2>See the feedback for one location.</h2>
            <p>Follow a visit from the Tap placard to the owner’s inbox and Playbook.</p>
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
