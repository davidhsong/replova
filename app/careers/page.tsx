import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { careerRoles } from '@/lib/careerRoles'

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Join Replova through a learning-first student internship in product, engineering, growth, customer experience, or review intelligence.',
  alternates: { canonical: '/careers' },
}

export default function CareersPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main">
        <section className="subpage-hero">
          <div className="t-eyebrow c-accent">Careers at Replova</div>
          <h1>Learn by building something real.</h1>
          <p>We are opening three small, learning-first internships for curious students who want a practical view of how a software startup gets built. No prior experience is required - just reliability, kindness, and a willingness to learn.</p>
          <div className="subpage-hero-actions"><Link href="#open-roles" className="btn btn-primary btn-lg">See open roles <ArrowIcon /></Link></div>
        </section>

        <section aria-labelledby="program-heading">
          <div className="page-rule-heading"><h2 id="program-heading">The internship path</h2><span>Remote · flexible · 8-12 weeks</span></div>
          <div className="internship-flow" aria-label="Three-stage internship learning path">
            <article className="flow-node">
              <div className="flow-node-head"><span>01</span><small>Foundation</small></div>
              <h3>Learn the system</h3>
              <p>Start with guided context, product examples, and the fundamentals behind your role.</p>
              <div className="flow-outcome"><span>You gain</span><strong>A clear map of the work</strong></div>
            </article>
            <div className="flow-connector" aria-hidden="true"><span>Practice</span><i /></div>
            <article className="flow-node">
              <div className="flow-node-head"><span>02</span><small>Supported work</small></div>
              <h3>Build with feedback</h3>
              <p>Practice on scoped tasks, ask questions early, and review decisions with a mentor.</p>
              <div className="flow-outcome"><span>You gain</span><strong>Confidence and useful habits</strong></div>
            </article>
            <div className="flow-connector" aria-hidden="true"><span>Apply</span><i /></div>
            <article className="flow-node flow-node-final">
              <div className="flow-node-head"><span>03</span><small>Evidence</small></div>
              <h3>Ship and reflect</h3>
              <p>Complete a small project, present what you learned, and document what you would improve.</p>
              <div className="flow-outcome"><span>You leave with</span><strong>A project story you can explain</strong></div>
            </article>
          </div>
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
