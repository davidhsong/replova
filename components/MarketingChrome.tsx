import { DropdownInteraction } from './marketing/DropdownInteraction'
import Link from 'next/link'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { MobileMarketingNav } from '@/components/marketing/MobileMarketingNav'

function BrandLogo({ height, placement, eager = false }: { height: number; placement: 'navbar' | 'footer'; eager?: boolean }) {
  return (
    <span className="brand-lockup">
      <ReplovaLogo variant="primary" surface="light" height={height} placement={placement} decorative eager={eager} />
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
  ['Replova Tap', 'Collect private ratings with a tap or scan.', '/#platform', 'reply'],
  ['Feedback inbox', 'Read a rating and comment for one location.', '/#sample-feedback', 'insights'],
  ['Recurring issues', 'Read the comments behind each count.', '/#sample-issue', 'insights'],
  ['Playbooks', 'See how the owner tracks a fix.', '/#sample-playbook', 'benchmark'],
] as const

const industryLinks = [
  ['Healthcare & wellness', 'Understand check-in and communication at each location.', '/industries/healthcare-wellness', 'healthcare'],
  ['Home services', 'Track communication, punctuality, and service quality.', '/industries/home-services', 'home'],
  ['Automotive', 'Understand trust, estimates, wait times, and repair quality.', '/industries/automotive', 'automotive'],
  ['Professional services', 'Turn client feedback into clear operational signals.', '/industries/professional-services', 'professional'],
  ['Retail & hospitality', 'Compare service, products, atmosphere, and value.', '/industries/retail-hospitality', 'retail'],
  ['Other local businesses', 'A flexible workflow for any local business.', '/industries/local-businesses', 'local'],
] as const

type NavDropdownProps = {
  label: string
  href: string
  links: ReadonlyArray<readonly [label: string, description: string, href: string, icon: NavIconName]>
}

export type NavIconName = 'reply' | 'insights' | 'benchmark' | 'healthcare' | 'home' | 'automotive' | 'professional' | 'retail' | 'local'

export function NavItemIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, React.ReactNode> = {
    reply: <><path d="M4 5.5h16v10H9l-5 4v-14Z" /><path d="M8 9h8M8 12h5" /></>,
    insights: <><path d="M4 19V9M10 19V5M16 19v-7M22 19V3" /><path d="M2 19h22" /></>,
    benchmark: <><path d="m4 17 5-5 4 3 7-9" /><path d="M15 6h5v5" /></>,
    healthcare: <><path d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10Z" /><path d="M9 12h6M12 9v6" /></>,
    home: <><path d="m3 11 9-7 9 7" /><path d="M5.5 10v10h13V10M10 20v-6h4v6" /></>,
    automotive: <><path d="m5 16-1.5-2 2-6h13l2 6-1.5 2" /><path d="M5 16h14v4h-2v-2H7v2H5v-4ZM7 12h10" /></>,
    professional: <><path d="M4 7h16v13H4zM9 7V4h6v3" /><path d="M4 12h16M10 12v2h4v-2" /></>,
    retail: <><path d="M5 9h14l-1 11H6L5 9Z" /><path d="M8 9a4 4 0 0 1 8 0" /></>,
    local: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  }

  return <svg className="nav-item-icon" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function NavDropdown({ label, href, links }: NavDropdownProps) {
  return (
    <DropdownInteraction>
      <Link href={href} className="nav-dropdown-trigger">{label} <ChevronDown /></Link>
      <div className="nav-popover" aria-label={`${label} menu`}>
        <div className="nav-popover-links">
          {links.map(([itemLabel, description, itemHref, icon]) => (
            <Link href={itemHref} key={itemLabel}>
              <NavItemIcon name={icon} />
              <span><strong>{itemLabel}</strong><small>{description}</small></span>
            </Link>
          ))}
        </div>
      </div>
    </DropdownInteraction>
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

export function MarketingHeader({ tapHome = false }: { tapHome?: boolean }) {
  return (
    <header className="lp-header">
      <div className="lp-nav-inner">
        <MobileMarketingNav tapHome={tapHome} />
        <Link href="/" aria-label="Replova home" className="lp-home-link"><BrandLogo placement="navbar" height={28} eager /></Link>
        <nav className="lp-menu" aria-label="Main navigation">
          <NavDropdown
            label="Platform"
            href="/#platform"
            links={platformLinks}
          />
          <NavDropdown
            label="Solutions"
            href="/industries"
            links={industryLinks}
          />
          <Link href="/resources">Resources</Link>
        </nav>
        <nav className="lp-account" aria-label="Account">
          <Link href="/signin" target="_blank" rel="noopener noreferrer" className="btn btn-quiet lp-signin">Sign in</Link>
          <Link href="/demo" className="btn btn-primary lp-demo-cta">
            <span className="lp-demo-label">
              <span>Request a demo</span>
              <span aria-hidden="true">Request a demo</span>
            </span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

const footerGroups = [
  {
    title: 'Platform',
    links: [
      ['Replova Tap', '/#platform'],
      ['Feedback inbox', '/#sample-feedback'],
      ['Recurring issues', '/#sample-issue'],
      ['Playbooks', '/#sample-playbook'],
      ['Sample dashboard', '/dashboard-preview'],
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
      ['Other local businesses', '/industries/local-businesses'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Careers', '/careers'],
      ['Request a demo', '/demo'],
      ['Create a workspace', '/onboard'],
      ['Sign in', '/signin'],
      ['Contact', 'mailto:support@replova.app'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Resource center', '/resources'],
      ['Customer review research', '/resources/customer-review-research'],
      ['Replying to reviews', '/resources#replying'],
      ['Customer insights', '/resources#insights'],
      ['Ethical review requests', '/resources#requests'],
    ],
  },
] as const

export function MarketingFooter({ tapHome = false }: { tapHome?: boolean }) {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-grid">
        <div className="lp-footer-brand">
          <BrandLogo placement="footer" height={32} />
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
            {group.links.map(([label, href]) => <Link key={label} href={tapHome && href.startsWith('/#') ? href.slice(1) : href}>{label}</Link>)}
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
