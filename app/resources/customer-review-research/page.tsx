import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'What research says about customer reviews',
  description: 'An evidence brief on review ratings, management responses, purchase behavior, and the limits of applying published findings to local businesses.',
  path: '/resources/customer-review-research',
})

const sources = [
  {
    id: 'reputation',
    number: '01',
    label: 'Purchase influence',
    title: 'Online reviews influence how customers choose.',
    finding: 'In a survey of 2,631 UK consumers, 94% said online reviews influenced their purchase decisions in some way.',
    method: 'Hotjar Survey Audiences surveyed 2,631 UK consumers ages 18 to 99+ on January 9, 2022, alongside 155 small and medium business leaders in the UK, US, and Australia.',
    limit: 'This is self-reported, UK-focused survey evidence. It does not prove reviews caused a purchase, is not a promise of business performance, and should not be treated as universal across countries, categories, or platforms.',
    source: '2022 State of Reviews: Changes in Consumer Buying',
    sourceNote: 'REVIEWS.io, Hotjar Survey Audiences, January 2022',
    href: 'https://assets.reviews.io/img/all-global-assets/pdf/2022-state-of-reviews-io-uk.pdf',
  },
  {
    id: 'responses',
    number: '02',
    label: 'Management responses',
    title: 'Responding can influence what future reviewers do.',
    finding: 'A Marketing Science study estimated a 0.12-star rating increase and a 12% increase in review volume for hotels that began responding to reviews.',
    method: 'The researchers analyzed hotel reviews and management responses across TripAdvisor and Expedia, using platform differences to estimate exposure to responses.',
    limit: 'The evidence comes from hospitality platforms. Response quality, business category, customer expectations, and platform behavior can change the outcome.',
    source: 'Online Reputation Management: Estimating the Impact of Management Responses on Consumer Reviews',
    sourceNote: 'Davide Proserpio and Giorgos Zervas, Marketing Science',
    href: 'https://pubsonline.informs.org/doi/abs/10.1287/mksc.2017.1043',
  },
  {
    id: 'purchase',
    number: '03',
    label: 'Purchase behavior',
    title: 'Review volume and credibility shape purchase decisions.',
    finding: 'Northwestern University’s Spiegel Research Center found that displaying five reviews was associated with 270% greater purchase likelihood than displaying none in its product dataset.',
    method: 'The research examined online product reviews and purchase behavior, including rating, volume, price, and verified-buyer signals.',
    limit: 'This study concerns ecommerce products rather than Google Business Profile reviews. It supports the importance of review evidence, not a universal local-business conversion rate.',
    source: 'How Online Reviews Influence Sales',
    sourceNote: 'Medill Spiegel Research Center, Northwestern University',
    href: 'https://spiegel.medill.northwestern.edu/how-online-reviews-influence-sales/',
  },
  {
    id: 'review-habits',
    number: '04',
    label: 'Review habits',
    title: 'Reviews are part of first-time purchase research.',
    finding: 'In a nationally representative survey of 4,787 U.S. adults, 82% said they at least sometimes read online ratings or reviews before purchasing something for the first time.',
    method: 'Pew Research Center surveyed its American Trends Panel from November 24 to December 21, 2015. The sample included 4,787 adults responding by web or mail, with a margin of sampling error of plus or minus 1.94 percentage points.',
    limit: 'This is self-reported U.S. survey data collected in 2015. It describes review-reading habits, not whether reviews caused a purchase or how frequently customers behave this way today.',
    source: 'Online Shopping and E-Commerce: Online Reviews',
    sourceNote: 'Aaron Smith and Monica Anderson, Pew Research Center',
    href: 'https://www.pewresearch.org/internet/2016/12/19/online-reviews/',
  },
] as const

export default function CustomerReviewResearchPage() {
  return (
    <div className="marketing-page research-page">
      <MarketingHeader />
      <main id="main-content" className="research-page-main">
        <section className="research-page-hero">
          <Link href="/resources" className="research-page-back">← Resource center</Link>
          <span className="research-page-kicker">Evidence brief · updated November 2026</span>
          <h1>What published research says about customer reviews.</h1>
          <p>Ratings and replies matter, but context matters too. This brief separates the findings from the assumptions so business owners can make practical decisions without treating one study as a guarantee.</p>
        </section>

        <div className="research-page-summary" aria-label="Evidence summary">
          <div><strong>4</strong><span>published research sources</span></div>
          <div><strong>4</strong><span>distinct study settings</span></div>
        </div>

        <div className="research-findings">
          {sources.map(item => (
            <article className="research-finding" id={item.id} key={item.id}>
              <div className="research-finding-index">{item.number}</div>
              <div className="research-finding-heading"><span>{item.label}</span><h2>{item.title}</h2></div>
              <div className="research-finding-body">
                <p className="research-finding-lead">{item.finding}</p>
                <dl><div><dt>How it was studied</dt><dd>{item.method}</dd></div><div><dt>What not to assume</dt><dd>{item.limit}</dd></div></dl>
                <a href={item.href} target="_blank" rel="noopener noreferrer">Read the original source <span aria-hidden="true">↗</span><small>{item.source}<br />{item.sourceNote}</small></a>
              </div>
            </article>
          ))}
        </div>

        <section className="research-application">
          <div><span>Applying the evidence</span><h2>Use reviews to improve the operation, not only the rating.</h2></div>
          <div>
            <p>Replova’s product model follows the part of the research that travels across categories: collect authentic feedback, respond with context, find repeated patterns, and give an owner control over what changes.</p>
            <ul><li>Keep ratings and review text together.</li><li>Separate one-off recovery work from recurring issues.</li><li>Draft replies without removing human approval.</li><li>Turn supported patterns into specific Playbook changes.</li></ul>
            <Link href="/dashboard-preview" className="btn btn-primary">See the workflow <ArrowIcon /></Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
