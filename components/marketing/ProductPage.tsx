import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { MarketingPage, PageHero } from './MarketingPage'
import './product.css'

type ProductPageProps = {
  name: string
  description: string
  status?: string
  photo?: { src: StaticImageData; alt: string }
  sectionTitle: string
  walkthrough?: boolean
  details: readonly (readonly [title: string, body: string])[]
}

export function ProductPage({ name, description, status, photo, sectionTitle, walkthrough, details }: ProductPageProps) {
  const List = walkthrough ? 'ol' : 'ul'

  return <MarketingPage>
    <PageHero title={name} lead={description} status={status} media={photo && (
      <Image className="product-photo" src={photo.src} alt={photo.alt}
        sizes="(max-width: 608px) calc(100vw - 48px), 560px" loading="eager" />
    )}>
      <Link className="btn btn-primary btn-lg" href="/demo">Request a demo</Link>
    </PageHero>
    <section className="lp-container story-section">
      <div className="section-intro editorial-copy"><h2 id={walkthrough ? 'how-it-works' : undefined}>{sectionTitle}</h2></div>
      <List className="product-details-list editorial-copy">
        {details.map(([title, body]) => <li key={title}><h3>{title}</h3><p>{body}</p></li>)}
      </List>
    </section>
  </MarketingPage>
}
