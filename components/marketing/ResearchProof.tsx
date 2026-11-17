import Image from 'next/image'
import Link from 'next/link'

type Study = {
  institution: string
  summary: string
  metric: string
  metricLabel: string
  secondaryMetric?: string
  secondaryLabel?: string
  href: string
  sourceLogo?: string
  sourceLogoAlt?: string
  sourceLogoWidth?: number
  sourceLogoHeight?: number
  sourceLogoClassName?: string
  preserveSourceLogo?: boolean
  researcher: string
  publication: string
}

const studies: Study[] = [
  {
    institution: 'REVIEWS.io',
    summary: 'In a survey of 2,631 UK consumers, 94% said online reviews influenced their purchase decisions in some way.',
    metric: '94%',
    metricLabel: 'reported review influence',
    secondaryMetric: '2,631',
    secondaryLabel: 'UK consumers surveyed',
    href: '/resources/customer-review-research#reputation',
    sourceLogo: '/brand/partner-logos/reviewsio-logo-black.svg',
    sourceLogoAlt: 'REVIEWS.io',
    sourceLogoWidth: 180,
    sourceLogoHeight: 29,
    preserveSourceLogo: true,
    researcher: 'REVIEWS.io research',
    publication: '2022 State of Reviews',
  },
  {
    institution: 'Marketing Science',
    summary: 'The study estimated higher ratings and more review activity after hotels began responding to customer reviews.',
    metric: '+0.12 stars',
    metricLabel: 'estimated rating lift',
    secondaryMetric: '+12%',
    secondaryLabel: 'review volume',
    href: '/resources/customer-review-research#responses',
    sourceLogo: '/brand/partner-logos/informs-society-for-marketing-science.jpg',
    sourceLogoAlt: 'INFORMS Society for Marketing Science',
    sourceLogoWidth: 430,
    sourceLogoHeight: 100,
    researcher: 'Davide Proserpio & Giorgos Zervas',
    publication: 'Marketing Science',
  },
  {
    institution: 'Medill Spiegel Research Center',
    summary: 'In product data analyzed by the center, purchase likelihood with five reviews was 270% greater than with no reviews.',
    metric: '270%',
    metricLabel: 'greater purchase likelihood',
    secondaryMetric: '5 reviews',
    secondaryLabel: 'compared with no reviews',
    href: '/resources/customer-review-research#purchase',
    sourceLogo: '/brand/partner-logos/medill-spiegel-research-center.jpg',
    sourceLogoAlt: 'Northwestern Medill Spiegel Research Center',
    sourceLogoWidth: 4502,
    sourceLogoHeight: 1796,
    sourceLogoClassName: 'research-study-source-image-medill',
    researcher: 'Medill Spiegel Research Center',
    publication: 'How Online Reviews Influence Sales',
  },
  {
    institution: 'Pew Research Center',
    summary: 'In a nationally representative survey of 4,787 U.S. adults, 82% said they at least sometimes read reviews before a first-time purchase.',
    metric: '82%',
    metricLabel: 'read reviews at least sometimes',
    secondaryMetric: '4,787',
    secondaryLabel: 'U.S. adults surveyed',
    href: '/resources/customer-review-research#review-habits',
    sourceLogo: '/brand/partner-logos/pew-research-center.svg',
    sourceLogoAlt: 'Pew Research Center',
    sourceLogoWidth: 484,
    sourceLogoHeight: 72,
    sourceLogoClassName: 'research-study-source-image-pew',
    researcher: 'Aaron Smith & Monica Anderson',
    publication: 'Pew Research Center, 2016',
  },
]

export function ResearchProof() {
  return (
    <section className="research-proof" aria-labelledby="research-proof-title">
      <div className="research-proof-inner">
        <h2 className="research-proof-heading" id="research-proof-title">Trusted by customer-focused businesses</h2>

        <div className="research-proof-grid">
          {studies.map(study => (
            <article className="research-study-card" key={study.institution}>
              <div className="research-study-meta">
                {study.sourceLogo ? (
                  <Image
                    className={`research-study-source-image${study.sourceLogoClassName ? ` ${study.sourceLogoClassName}` : ''}${study.preserveSourceLogo ? ' research-study-source-image-original' : ''}`}
                    src={study.sourceLogo}
                    alt={study.sourceLogoAlt ?? study.institution}
                    width={study.sourceLogoWidth ?? 430}
                    height={study.sourceLogoHeight ?? 100}
                    loading="eager"
                  />
                ) : <span className="research-study-source-text">{study.institution}</span>}
                <Link href={study.href}>View case study <span aria-hidden="true">↗</span></Link>
              </div>
              <p className="research-study-finding">{study.summary}</p>
              <div className="research-study-citation">
                <strong>{study.researcher}</strong>
                <span>{study.publication}</span>
              </div>
              <div className="research-study-metrics">
                <div><strong>{study.metric}</strong><span>{study.metricLabel}</span></div>
                {study.secondaryMetric ? <div><strong>{study.secondaryMetric}</strong><span>{study.secondaryLabel}</span></div> : <div><strong>1 star</strong><span>rating movement studied</span></div>}
              </div>
            </article>
          ))}
        </div>

        <div className="trusted-businesses" aria-label="Trusted businesses">
          <div className="trusted-business-logos">
            <span className="trusted-business-logo trusted-business-logo-sunright">
              <Image src="/brand/partner-logos/sunright-tea-studio.svg" alt="Sunright Tea Studio" width={222} height={50} unoptimized />
            </span>
            <span className="trusted-business-logo trusted-business-logo-happy-lemon">
              <Image src="/brand/partner-logos/happy-lemon.webp" alt="Happy Lemon" width={800} height={275} />
            </span>
            <span className="trusted-business-logo trusted-business-logo-sentral">
              <Image src="/brand/partner-logos/sentral.png" alt="Sentral" width={287} height={48} />
            </span>
            <span className="trusted-business-logo trusted-business-logo-whatcoffee">
              <Image src="/brand/partner-logos/whatcoffee-logo-mark.png" alt="WhatCoffee & Bakery" width={115} height={91} />
              <small>WhatCoffee &amp; Bakery</small>
            </span>
            <span className="trusted-business-logo trusted-business-logo-clara">
              <Image src="/brand/partner-logos/clara-medical-spa.png" alt="Clara Medical Spa" width={1140} height={676} />
            </span>
            <span className="trusted-business-logo trusted-business-logo-text" aria-label="K & S Complete Auto Repair">
              <strong>K &amp; S</strong>
              <small>Complete Auto Repair</small>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
