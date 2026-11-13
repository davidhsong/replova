import Link from 'next/link'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'

export function BrandLogo({ height = 27, eager = false }: { height?: number; eager?: boolean }) {
  return (
    <span className="brand-lockup">
      <ReplovaLogo variant="primary" surface="light" height={height} decorative eager={eager} />
    </span>
  )
}

function ChevronDown() {
  return (
    <svg className="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

const platformLinks = [
  ['Review response workflow', 'Draft, approve, and publish thoughtful Google replies.', '/#platform'],
  ['Reputation intelligence', 'See sentiment, recurring themes, scores, and staff praise.', '/#intelligence'],
  ['Competitor benchmarking', 'Compare your public rating with nearby businesses.', '/dashboard-preview'],
] as const

const industryLinks = [
  ['Healthcare & wellness', 'Find patient experience themes across every review.', '/industries/healthcare-wellness'],
  ['Home services', 'Track communication, punctuality, and service quality.', '/industries/home-services'],
  ['Automotive', 'Understand trust, estimates, wait times, and repair quality.', '/industries/automotive'],
  ['Professional services', 'Turn client feedback into clear operational signals.', '/industries/professional-services'],
  ['Retail & hospitality', 'Compare service, products, atmosphere, and value.', '/industries/retail-hospitality'],
  ['Other local businesses', 'Use the same review workflow for any local business.', '/industries/local-businesses'],
] as const

type NavDropdownProps = {
  label: string
  href: string
  introLabel: string
  introTitle: string
  introBody: string
  links: ReadonlyArray<readonly [label: string, description: string, href: string]>
}

function NavDropdown({ label, href, introLabel, introTitle, introBody, links }: NavDropdownProps) {
  return (
    <div className="nav-dropdown">
      <Link href={href} className="nav-dropdown-trigger">{label} <ChevronDown /></Link>
      <div className="nav-popover nav-menu-grid">
        <div className="nav-popover-intro">
          <span>{introLabel}</span>
          <div>
            <strong>{introTitle}</strong>
            <p>{introBody}</p>
          </div>
        </div>
        <div className="nav-popover-links">
          {links.map(([itemLabel, description, itemHref], index) => (
            <Link href={itemHref} key={itemLabel}>
              <span className="nav-link-index">0{index + 1}</span>
              <span><strong>{itemLabel}</strong><small>{description}</small></span>
              <ArrowIcon />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {diagonal ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M5 12h14M13 6l6 6-6 6" />}
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.33V8.98h3.42v1.57h.05c.47-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.46v6.3ZM5.31 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.04H3.53V8.98h3.56v11.47Z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.11l11.97 15.64Z" />
    </svg>
  )
}

export function MarketingHeader() {
  return (
    <header className="lp-header">
      <div className="lp-nav-inner">
        <Link href="/" aria-label="Replova home"><BrandLogo eager /></Link>
        <nav className="lp-menu" aria-label="Main navigation">
          <NavDropdown
            label="Platform"
            href="/#platform"
            introLabel="Platform"
            introTitle="Everything after the review arrives."
            introBody="Keep responses moving and turn customer language into decisions."
            links={platformLinks}
          />
          <NavDropdown
            label="Solutions"
            href="/industries"
            introLabel="Solutions"
            introTitle="Built for the way local businesses earn trust."
            introBody="See how Replova adapts the same review workflow to different customer experiences."
            links={industryLinks}
          />
          <Link href="/resources">Resources</Link>
          <Link href="/careers">Careers</Link>
        </nav>
        <nav className="lp-account" aria-label="Account">
          <Link href="/signin" target="_blank" rel="noopener noreferrer" className="btn btn-quiet lp-signin">Sign in</Link>
          <Link href="/demo" className="btn btn-primary">Request a demo <ArrowIcon /></Link>
        </nav>
      </div>
    </header>
  )
}

const footerGroups = [
  {
    title: 'Platform',
    links: [
      ['Review response workflow', '/#platform'],
      ['Reputation intelligence', '/#intelligence'],
      ['Pricing', '/#pricing'],
    ],
  },
  {
    title: 'Solutions',
    links: [
      ['Healthcare & wellness', '/industries/healthcare-wellness'],
      ['Home services', '/industries/home-services'],
      ['Automotive', '/industries/automotive'],
      ['Professional services', '/industries/professional-services'],
      ['Retail & hospitality', '/industries/retail-hospitality'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Careers', '/careers'],
      ['Request a demo', '/demo'],
      ['Sign in', '/signin'],
      ['Contact', 'mailto:support@replova.app'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Resource center', '/resources'],
      ['Replying to reviews', '/resources#replying'],
      ['Customer insights', '/resources#insights'],
      ['Ethical review requests', '/resources#requests'],
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-grid">
        <div className="lp-footer-brand">
          <BrandLogo height={32} />
          <div className="lp-footer-socials">
            <a
              href="https://x.com/Replova"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Replova on X"
              title="Replova on X"
            >
              <XIcon />
            </a>
            <a
              href="https://www.linkedin.com/company/replova/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit Replova on LinkedIn"
              title="Replova on LinkedIn"
            >
              <LinkedInIcon />
            </a>
          </div>
        </div>
        {footerGroups.map(group => (
          <div className="lp-footer-group" key={group.title}>
            <strong>{group.title}</strong>
            {group.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
          </div>
        ))}
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Replova</span>
          <nav aria-label="Legal">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms of service</Link>
            <Link href="/refunds">Refunds</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
