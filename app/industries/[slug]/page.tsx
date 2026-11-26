import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { getIndustrySolution, industrySolutions } from '@/lib/industrySolutions'
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
    title: `${solution.name} Solutions`,
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
        <Link href="/industries" className="solution-back-link">All solutions <ArrowIcon /></Link>

        <section className="solution-hero">
          <div className="t-eyebrow c-accent">{solution.eyebrow}</div>
          <h1>{solution.headline}</h1>
          <p>{solution.lede}</p>
          <div className="subpage-hero-actions">
            <Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link>
            <Link href="/#platform" className="btn btn-ghost btn-lg">See the platform</Link>
          </div>
        </section>

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

        <section className="solution-section solution-example">
          <div className="solution-example-review">
            <div className="t-eyebrow">Fictional private visit · 4 of 5</div>
            <blockquote>“{solution.example.comment}”</blockquote>
            <div className="solution-review-rating" aria-label="Four out of five stars">★★★★<span>★</span></div>
          </div>
          <div className="solution-example-analysis">
            <div>
              <div className="t-eyebrow c-accent">Reported issue</div>
              <p>{solution.example.issue}</p>
            </div>
            <div>
              <div className="t-eyebrow c-accent">Owner action</div>
              <p>{solution.example.action}</p>
            </div>
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

        <section className="solution-section solution-related">
          <div className="solution-section-heading">
            <div className="t-eyebrow c-accent">More solutions</div>
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
