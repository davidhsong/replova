import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome'
import { VisitSample, features } from '@/components/marketing/VisitSample'
import { Eyebrow } from '@/components/marketing/Eyebrow'
import { createPageMetadata } from '@/lib/seo'

const pages = {
  'replova-tap': {
    label: 'Replova Tap', title: 'Hear from customers while the visit is fresh.',
    description: 'A small placard gives each location its own private feedback form. Customers can tap or scan, choose a rating, and leave a few words.',
  },
  'how-tap-works': {
    label: 'How Tap works', title: 'From the first tap to the next shift.',
    description: 'Place a placard, read what customers send, and give your team one clear change to try. Follow six visits at a fictional Downtown location.',
  },
}
const steps = [
  ['Place the placard', 'Choose the location and time zone in Tap. Put its placard near the exit or handoff point. Use the test link to check the form.'],
  ['Collect private feedback', 'Customers tap or scan and choose a rating. Their optional comment arrives beside the rating in the location’s inbox.'],
  ['Read repeated comments', 'Open a recurring issue and compare the original visits. At Downtown, two of six customers needed directions when they arrived.'],
  ['Track a fix', 'Give the shift lead the entrance sign task. After the change, read the next six comments and record what happened.'],
]
type Props = { params: Promise<{ slug: string }> }
function pageData(slug: string) {
  if (slug !== 'replova-tap' && slug !== 'how-tap-works') notFound()
  return pages[slug]
}
export function generateStaticParams() { return Object.keys(pages).map(slug => ({ slug })) }
export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const page = pageData(slug)
  return createPageMetadata({ title: page.label, description: page.description, path: `/platform/${slug}` })
}
export default async function PlatformPage({ params }: Props) {
  const { slug } = await params
  const page = pageData(slug)
  const guide = slug === 'how-tap-works'
  return <div className="marketing-page"><MarketingHeader /><main id="main-content" className="marketing-page-main platform-page">
    <section className="internal-hero"><span className="hero-category">{page.label}</span><h1>{page.title}</h1><p>{page.description}</p><Link className="btn btn-primary" href="/demo">Request a demo</Link></section>
    <div className="platform-demo"><VisitSample feature="tap" /><VisitSample feature="inbox" /></div>
    <section className="solution-section"><Eyebrow>{guide ? 'Implementation guide' : 'Capabilities'}</Eyebrow><h2>{guide ? 'Set up Tap at your location.' : 'See the visit through.'}</h2>
      <div className="platform-grid">{features.map((feature,i) => <article key={feature.id}><div className="platform-illustration"><VisitSample feature={feature.id} /></div><h3>{guide ? steps[i][0] : feature.label}</h3><p>{guide ? steps[i][1] : feature.description}</p></article>)}</div>
    </section><section className="final-cta"><div className="final-cta-inner"><h2>See Tap at work.</h2><p>Walk through the customer form and the owner’s inbox.</p><Link className="btn btn-primary" href="/demo">Request a demo</Link><Link href={guide ? '/platform/replova-tap' : '/platform/how-tap-works'}>{guide ? 'Explore Replova Tap' : 'Read the implementation guide'} →</Link></div></section>
  </main><MarketingFooter /></div>
}
