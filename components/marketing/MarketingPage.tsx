import type { ReactNode } from 'react'
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome'

export function MarketingPage({ children, industry }: { children: ReactNode; industry?: string }) {
  return <div className="marketing-shell tap-home">
    <MarketingHeader industry={industry} />
    <main id="main-content">{children}</main>
    <MarketingFooter industry={industry} />
  </div>
}

export function PageHero({ label, title, status, lead, children, media }: {
  label?: ReactNode; title: ReactNode; status?: string; lead: string; children?: ReactNode; media?: ReactNode
}) {
  return <section className="lp-hero-centered">
    {label && <div className="hero-category">{label}</div>}
    {status ? <div className="product-title-row"><h1>{title}</h1><span className="hero-category">{status}</span></div> : <h1>{title}</h1>}
    <p>{lead}</p>
    {children && <div className="hero-actions hero-actions-centered">{children}</div>}
    {media}
  </section>
}

export function ExampleFrame({ children }: { children: ReactNode }) {
  return <div className="story-card"><div className="story-visual">{children}</div></div>
}
