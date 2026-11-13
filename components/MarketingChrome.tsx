import Image from 'next/image'
import Link from 'next/link'

export function BrandLogo() {
  return (
    <span className="brand-lockup">
      <Image src="/replova-mark.svg" alt="" width={27} height={27} className="brand-mark" />
      <span>Replova</span>
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
  ['Healthcare & wellness', '/industries/healthcare-wellness'],
  ['Home services', '/industries/home-services'],
  ['Automotive', '/industries/automotive'],
  ['Professional services', '/industries/professional-services'],
  ['Retail & hospitality', '/industries/retail-hospitality'],
  ['Other local businesses', '/industries/local-businesses'],
] as const

function PlatformDropdown() {
  return (
    <div className="nav-dropdown nav-dropdown-features">
      <Link href="/#platform" className="nav-dropdown-trigger">Platform <ChevronDown /></Link>
      <div className="nav-popover nav-feature-grid">
        <div className="nav-popover-intro">
          <span>Platform</span>
          <strong>Everything after the review arrives.</strong>
          <p>Keep responses moving and turn customer language into decisions.</p>
        </div>
        <div className="nav-popover-links">
          {platformLinks.map(([label, description, href], index) => (
            <Link href={href} key={label}>
              <span className="nav-link-index">0{index + 1}</span>
              <span><strong>{label}</strong><small>{description}</small></span>
              <ArrowIcon />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function SolutionsDropdown() {
  return (
    <div className="nav-dropdown nav-dropdown-industries">
      <Link href="/industries" className="nav-dropdown-trigger">Solutions <ChevronDown /></Link>
      <div className="nav-popover nav-industry-grid">
        <div className="nav-popover-heading"><span>Built for local trust</span><Link href="/industries">View all <ArrowIcon /></Link></div>
        <div className="nav-industry-links">
          {industryLinks.map(([label, href], index) => (
            <Link href={href} key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}<ArrowIcon /></Link>
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

export function MarketingHeader() {
  return (
    <header className="lp-header">
      <div className="lp-nav-inner">
        <Link href="/" aria-label="Replova home"><BrandLogo /></Link>
        <nav className="lp-menu" aria-label="Main navigation">
          <PlatformDropdown />
          <SolutionsDropdown />
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
    title: 'Explore',
    links: [
      ['Platform', '/#platform'],
      ['Solutions', '/industries'],
      ['Resources', '/resources'],
      ['Careers', '/careers'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Refunds', '/refunds'],
      ['Contact', 'mailto:support@replova.app'],
    ],
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-grid">
        <div className="lp-footer-brand">
          <BrandLogo />
          <p>Google review operations and reputation intelligence for every local business.</p>
        </div>
        {footerGroups.map(group => (
          <div className="lp-footer-group" key={group.title}>
            <strong>{group.title}</strong>
            {group.links.map(([label, href]) => <Link key={label} href={href}>{label}</Link>)}
          </div>
        ))}
        <div className="lp-footer-bottom">
          <span>© {new Date().getFullYear()} Replova</span>
          <span>Built for businesses that care what customers think.</span>
        </div>
      </div>
    </footer>
  )
}
