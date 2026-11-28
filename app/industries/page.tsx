import Link from 'next/link'
import { ArrowIcon, NavItemIcon } from '@/components/MarketingChrome'
import { MarketingPage, PageHero } from '@/components/marketing/MarketingPage'
import { industrySolutions } from '@/lib/industrySolutions'
import { createPageMetadata } from '@/lib/seo'

const description = 'Explore how operators collect private feedback, from drink pickup and hotel rooms to repair estimates and office visits.'
export const metadata = createPageMetadata({ title: 'Industries', description, path: '/industries' })

export default function IndustriesPage() {
  return <MarketingPage>
    <PageHero label="Industries" title="What do customers notice during a visit?" lead={description} />
    <section className="lp-container industries-section" aria-label="Explore industries">
      <div className="industry-grid">{industrySolutions.map(industry =>
        <Link className="industry-card" href={'/industries/' + industry.slug} key={industry.slug}>
          <div className="industry-card-heading">
            <h2>{industry.icon && <NavItemIcon name={industry.icon} />}{industry.name}</h2>
            <ArrowIcon diagonal />
          </div>
          <p>{industry.headline}</p>
        </Link>
      )}</div>
    </section>
  </MarketingPage>
}
