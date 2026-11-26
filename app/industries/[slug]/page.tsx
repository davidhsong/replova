import { TapFilm } from '@/components/marketing/TapFilm'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { ResearchProof } from '@/components/marketing/ResearchProof'
import { FeatureIcon } from '@/components/marketing/VisitSample'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { getIndustrySolution, industrySolutions, serviceExamples } from '@/lib/industrySolutions'
import { createPageMetadata } from '@/lib/seo'

type SolutionPageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return industrySolutions.map(solution => ({ slug: solution.slug }))
}

export async function generateMetadata({ params }: SolutionPageProps): Promise<Metadata> {
  const { slug } = await params
  const solution = getIndustrySolution(slug)

  if (!solution) return { robots: { index: false, follow: false } }

  return createPageMetadata({
    title: `Replova Tap for ${solution.name}`,
    description: solution.lede,
    path: `/industries/${solution.slug}`,
  })
}

export default async function SolutionDetailPage({ params }: SolutionPageProps) {
  const { slug } = await params
  const solution = getIndustrySolution(slug)

  if (!solution) notFound()

  const relatedSolutions = industrySolutions.filter(item => item.slug !== solution.slug).slice(0, 3)

  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main solution-detail-page">
        <Link href="/industries" className="solution-back-link">All industries <ArrowIcon /></Link>

        <section className="solution-hero internal-hero">
          <span className="hero-category">{solution.eyebrow}</span>
          <h1>{solution.headline}</h1>
          <p>{solution.lede}</p>
          <div className="subpage-hero-actions">
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
          </div>
        </section>

        {slug === 'boba-tea-shops' ? <TapFilm /> : (
          <section className="solution-section solution-example">
          <div className="solution-example-review">
            <small>Sample data</small><div><FeatureIcon id="inbox" /> Feedback inbox · 4 / 5</div>
            <blockquote>“{solution.example.comment}”</blockquote>
            <div className="solution-review-rating" aria-label="Four out of five stars">★★★★<span>★</span></div>
          </div>
          <div className="solution-example-analysis">
            <div>
              <div className="t-eyebrow c-accent"><FeatureIcon id="issues" /> Recurring issue</div>
              <p>{solution.example.issue}</p>
            </div>
            <div>
              <div className="t-eyebrow c-accent"><FeatureIcon id="playbook" /> Owner action</div>
              <p>{solution.example.action}</p>
            </div>
          </div>
        </section>
        )}

        <section className="solution-audience" aria-label={`Example businesses in ${solution.name}`}>
          <span>Built for</span>
          <div className="solution-audience-list">
            {solution.businesses.map(business => <span key={business}>{business}</span>)}
          </div>
        </section>

        <section className="solution-section solution-operating-grid">
          <div className="solution-section-intro">
            <div className="t-eyebrow c-accent">The operating view</div>
            <h2>The customer moments worth watching.</h2>
            <p>A private Tap rating tells you how the visit went. An optional comment can tell you which part of the experience mattered.</p>
          </div>
          <div className="solution-moment-list">
            {solution.moments.map((moment, index) => (
              <div className="solution-moment" key={moment.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{moment.title}</h3>
                <p>{moment.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="solution-section">
          <div className="solution-section-heading">
            <div className="t-eyebrow c-accent">How it works</div>
            <h2>From a private rating to a local fix.</h2>
          </div>
          <div className="solution-workflow-list">
            {solution.workflow.map((step, index) => (
              <div className="solution-workflow-row" key={step.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="solution-section solution-signal-layout">
          <div>
            <div className="t-eyebrow c-accent">Common signals</div>
            <h2>Know what is helping trust and what is quietly eroding it.</h2>
          </div>
          <ul>
            {solution.signals.map((signal, index) => (
              <li key={signal}><span>{String(index + 1).padStart(2, '0')}</span>{signal}</li>
            ))}
          </ul>
        </section>

        {slug === 'local-services' && <section className="solution-section"><h2>Across service teams</h2><div className="service-examples">{serviceExamples.map(item => <article key={item.slug}><h3>{item.name}</h3><p>{item.lede}</p><blockquote>“{item.example.comment}”</blockquote><p>{item.example.action}</p></article>)}</div></section>}
        <ResearchProof institutions={slug === 'retail-hospitality' || slug === 'boba-tea-shops' ? ['Marketing Science', 'Medill Spiegel Research Center'] : ['REVIEWS.io', 'Pew Research Center']} />
        <HomeFaq />
        <section className="solution-section solution-related">
          <div className="solution-section-heading">
            <div className="t-eyebrow c-accent">More industries</div>
            <h2>Explore another customer journey.</h2>
          </div>
          <div className="solution-related-list">
            {relatedSolutions.map(item => (
              <Link href={`/industries/${item.slug}`} key={item.slug}>
                <span>{item.name}</span>
                <ArrowIcon />
              </Link>
            ))}
          </div>
        </section>

        <section className="final-cta solution-final-cta">
          <div className="final-cta-inner">
            <h2>See Replova with your business in mind.</h2>
            <p>Explore the Tap inbox and Playbooks for a selected location. If you also manage Google reviews, see how to prepare a reply for your Business Profile.</p>
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
