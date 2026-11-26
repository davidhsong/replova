import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import CareersFlow from '@/components/CareersFlow'
import { careerRoles } from '@/lib/careerRoles'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Careers',
  description: 'Join Replova through a learning-first student internship in product, engineering, growth, customer experience, or review intelligence.',
  path: '/careers',
})

export default function CareersPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main">
        <section className="subpage-hero">
          <div className="t-eyebrow c-accent">Careers at Replova</div>
          <h1>Learn by building something real.</h1>
          <p>We offer {careerRoles.length} learning-first internships for curious students who want a practical view of how a software startup gets built. No prior experience is required - just reliability, kindness, and a willingness to learn.</p>
          <div className="subpage-hero-actions"><Link href="#open-roles" className="btn btn-primary btn-lg">See open roles <ArrowIcon /></Link></div>
        </section>

        <section aria-labelledby="program-heading">
          <div className="page-rule-heading"><h2 id="program-heading">The internship path</h2><span>Remote · flexible · 8-12 weeks</span></div>
          <CareersFlow />
        </section>

        <section id="open-roles" aria-labelledby="roles-heading">
          <div className="page-rule-heading"><h2 id="roles-heading">Open positions ({careerRoles.length})</h2><span>Student internships · unpaid</span></div>
          <div className="role-list">
            {careerRoles.map(role => <Link href={`/careers/${role.slug}`} className="role-link" key={role.key}><strong>{role.title}</strong><span>Remote · flexible schedule</span><ArrowIcon diagonal /></Link>)}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
