import { productLinks, industryLinks } from '@/lib/marketingNavigation'
import { IndustryDemoLink } from './marketing/IndustryBooking'
import { NavItemIcon, type NavIconName } from './marketing/NavItemIcon'
import './marketing/marketing.css'
import { NavDestination } from './marketing/NavDestination'
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

type NavDropdownProps = {
  label: string
  links: ReadonlyArray<readonly [label: string, description: string, href: string, icon: NavIconName]>
}

export { NavItemIcon }
export type { NavIconName }

function NavDropdown({ label, links }: NavDropdownProps) {
  return (
    <DropdownInteraction label={label}>
      <div className="nav-popover-links">
        {links.map(([itemLabel, description, itemHref, icon]) => (
          <NavDestination data-industry={itemHref.startsWith('/industries/') ? itemHref.split('/')[2] : undefined} href={itemHref} key={itemLabel}>
            <NavItemIcon name={icon} />
            <span><strong>{itemLabel}</strong><small>{description}</small></span>
          </NavDestination>
        ))}
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

export function MarketingHeader({ tapHome = false, industry }: { tapHome?: boolean; industry?: string }) {
  return (
    <header className="lp-header">
      <div className="lp-nav-inner">
        <MobileMarketingNav tapHome={tapHome} industry={industry} />
        <Link href="/" aria-label="Replova home" className="lp-home-link"><BrandLogo placement="navbar" height={28} eager /></Link>
        <nav className="lp-menu" aria-label="Main navigation">
          <NavDropdown
            label="Products"
            links={productLinks}
          />
          <NavDropdown
            label="Industries"
            links={industryLinks}
          />
          <NavDestination href="/resources">Resources</NavDestination>
        </nav>
        <nav className="lp-account" aria-label="Account">
          <Link href="/signin" target="_blank" rel="noopener noreferrer" className="btn btn-quiet lp-signin">Sign in</Link>
          <IndustryDemoLink industry={industry} className="btn btn-primary lp-demo-cta">
            <span className="lp-demo-label">
              <span>Request a demo</span>
              <span aria-hidden="true">Request a demo</span>
            </span>
          </IndustryDemoLink>
        </nav>
      </div>
    </header>
  )
}

const footerGroups = [
  {
    title: 'Products',
    links: productLinks.map(([label, , href]) => [label, href] as const),
  },
  {
    title: 'Industries',
    links: industryLinks.map(([label, , href]) => [label, href] as const),
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

export function MarketingFooter({ tapHome = false, industry }: { tapHome?: boolean; industry?: string }) {
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
            {group.links.map(([label, href]) => href === '/demo' ? <IndustryDemoLink key={label} industry={industry}>{label}</IndustryDemoLink> : <Link key={label} href={tapHome && href.startsWith('/#') ? href.slice(1) : href}>{label}</Link>)}
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
