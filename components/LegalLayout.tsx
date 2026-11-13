import type { ReactNode } from 'react'
import { MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'

export type LegalSection = { heading: string; content: ReactNode }

type Page = 'terms' | 'privacy' | 'refunds'

const TABS: { key: Page; label: string; href: string }[] = [
  { key: 'terms', label: 'Terms', href: '/terms' },
  { key: 'privacy', label: 'Privacy', href: '/privacy' },
  { key: 'refunds', label: 'Refunds', href: '/refunds' },
]

interface Props {
  page: Page
  title: string
  kicker: string
  sections: LegalSection[]
}

export default function LegalLayout({ page, title, kicker, sections }: Props) {
  return (
    <div className="marketing-page legal-page">
      <MarketingHeader />
      <main id="main-content" className="legal-page-main">
        <header className="legal-page-header">
          <div className="t-eyebrow">{kicker}</div>
          <h1>{title}</h1>
        </header>

        <nav className="legal-tabs" aria-label="Policy pages">
          {TABS.map(tab => (
            <a key={tab.key} href={tab.href} aria-current={page === tab.key ? 'page' : undefined}>
              {tab.label}
            </a>
          ))}
        </nav>

        <div className="legal-sections">
          {sections.map((section, index) => (
            <section key={section.heading} className="legal-section">
              <div className="legal-section-index">§{(index + 1).toString().padStart(2, '0')}</div>
              <div>
                <h2>{section.heading}</h2>
                <div className="legal-section-content">{section.content}</div>
              </div>
            </section>
          ))}
        </div>

        <p className="legal-contact">
          Questions? <a href="mailto:support@replova.app">support@replova.app</a>
        </p>
      </main>
      <MarketingFooter />
    </div>
  )
}
