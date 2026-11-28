import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TapFilm } from '@/components/marketing/TapFilm'
import { HomeFaq } from '@/components/marketing/HomeFaq'
import { ResearchProof } from '@/components/marketing/ResearchProof'
import { ExampleFrame, MarketingPage, PageHero } from '@/components/marketing/MarketingPage'
import { IndustryDemoLink, IndustryPageView } from '@/components/marketing/IndustryBooking'
import { getIndustrySolution, industrySolutions } from '@/lib/industrySolutions'
import { createPageMetadata } from '@/lib/seo'

type Props = { params: Promise<{ slug: string }> }
export function generateStaticParams() { return industrySolutions.map(({ slug }) => ({ slug })) }

export async function generateMetadata({ params }: Props) {
  const industry = getIndustrySolution((await params).slug)
  if (!industry) notFound()
  return createPageMetadata({ title: 'Replova Tap for ' + industry.name, description: industry.lede, path: `/industries/${industry.slug}` })
}

export default async function IndustryPage({ params }: Props) {
  const industry = getIndustrySolution((await params).slug)
  if (!industry) notFound()
  const { name, slug, headline, lede, placement, comment, action } = industry

  return <MarketingPage industry={slug}>
    <IndustryPageView industry={slug} />
    <PageHero label={<><Link href="/industries">Industries</Link> / {name}</>} title={headline} lead={lede}>
      <IndustryDemoLink industry={slug} className="btn btn-primary btn-lg">Request a demo</IndustryDemoLink>
    </PageHero>
    <section className="lp-container story-section" aria-label={name + ' feedback example'}>
      <div className="story-grid">
        <ExampleFrame><article className="visit-ui">
          <header>Private Tap feedback</header><h3>{placement}</h3>
          <blockquote>“{comment}”</blockquote><footer>Sample data</footer>
        </article></ExampleFrame>
        <div className="section-intro editorial-copy">
          <h2>What your team could try</h2><p>{action}</p>
          <Link href="/products/replova-tap#how-it-works">See how Replova Tap works →</Link>
        </div>
      </div>
    </section>
    {slug === 'boba-tea-shops' && <TapFilm />}
    <ResearchProof institutions={['boba-tea-shops', 'hotels-short-stays', 'specialty-retail-stores'].includes(slug) ? ['Marketing Science', 'Medill Spiegel Research Center'] : ['REVIEWS.io', 'Pew Research Center']} />
    <HomeFaq />
  </MarketingPage>
}
