import Image from 'next/image'
import Link from 'next/link'

export function BrandLogo() {
  return (
    <span className="brand-lockup">
      <Image src="/replova-logo-transparent.png" alt="" width={27} height={27} className="brand-mark" />
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

function LinkedInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.86-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.33V8.98h3.42v1.57h.05c.47-.9 1.64-1.86 3.37-1.86 3.6 0 4.27 2.37 4.27 5.46v6.3ZM5.31 7.41a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.04H3.53V8.98h3.56v11.47Z" />
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
          <BrandLogo />
          <div className="lp-footer-socials">
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
