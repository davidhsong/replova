import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'
import { careerRoles, getCareerRoleBySlug } from '@/lib/careerRoles'
import { createPageMetadata } from '@/lib/seo'
import ApplicationForm from '../ApplicationForm'

type CareerRolePageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return careerRoles.map(role => ({ slug: role.slug }))
}

export async function generateMetadata({ params }: CareerRolePageProps): Promise<Metadata> {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)

  if (!role) return { title: 'Role Not Found', robots: { index: false, follow: false } }

  return createPageMetadata({
    title: role.title,
    description: `${role.summary} No prior experience required. This is a remote, unpaid, learning-first student internship.`,
    path: `/careers/${role.slug}`,
  })
}

export default async function CareerRolePage({ params }: CareerRolePageProps) {
  const { slug } = await params
  const role = getCareerRoleBySlug(slug)
  if (!role) notFound()

  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main career-role-page">
        <article className="career-job-posting">
          <Link href="/careers#open-roles" className="career-back-link">&larr; View all open roles</Link>

          <header className="career-job-header">
            <div className="t-eyebrow c-accent">Student internship</div>
            <h1>{role.title}</h1>
            <p>{role.summary}</p>
            <div className="career-job-facts" aria-label="Position details">
              <span>Remote</span><span>8-12 weeks</span><span>8-12 hours/week</span><span>Unpaid</span><span>No office days</span>
            </div>
            <a href="#apply" className="btn btn-primary btn-lg career-apply-link">Apply for this role <ArrowIcon /></a>
          </header>

          <div className="career-job-layout">
            <aside className="career-section-nav" aria-label="Job posting sections">
              <span>In this posting</span>
              <nav>
                <a href="#who-we-are"><b>01</b>Who we are</a>
                <a href="#the-role"><b>02</b>The role</a>
                <a href="#why-join"><b>03</b>Why join</a>
                <a href="#what-you-learn"><b>04</b>What you will learn</a>
                <a href="#projects"><b>05</b>Learning projects</a>
                <a href="#requirements"><b>06</b>Requirements</a>
                <a href="#program-details"><b>07</b>Program details</a>
              </nav>
            </aside>

            <div className="career-job-content">
              <section id="who-we-are" className="career-copy-section">
                <div className="career-section-heading"><span>01 / Company</span><h2>Who we are</h2></div>
                <p className="career-lead">Replova helps businesses learn from private customer feedback at each location.</p>
                <p>With Tap, customers leave a rating and optional comment. The owner can read what happened and track a change in a Playbook.</p>
                <p>Teams that manage public Google reviews can also draft and publish replies. The work spans product design, software, AI quality, customer research, operations, and the trust required to handle real customer feedback responsibly.</p>
              </section>

              <section id="the-role" className="career-copy-section">
                <div className="career-section-heading"><span>02 / Position</span><h2>The role</h2></div>
                <p className="career-lead">{role.role}</p>
                <p>This is a learning-first internship. You will work alongside a founder or project mentor, receive context before taking on a task, and get regular feedback as you build confidence.</p>
              </section>

              <section id="why-join" className="career-copy-section">
                <div className="career-section-heading"><span>03 / Experience</span><h2>Why you should join</h2></div>
                <ul className="career-highlight-list">
                  <li><strong>Learn close to the work</strong><span>See how customer needs become product, research, and operating decisions.</span></li>
                  <li><strong>Build a clear body of evidence</strong><span>Leave with a learning summary and non-confidential work you can discuss in future interviews.</span></li>
                  <li><strong>Get direct feedback</strong><span>Review progress with a founder or project mentor instead of working through an unstructured task list.</span></li>
                  <li><strong>Work around school</strong><span>Schedule approximately 8-12 hours each week around your academic commitments.</span></li>
                </ul>
              </section>

              <section id="what-you-learn" className="career-copy-section">
                <div className="career-section-heading"><span>04 / Skills</span><h2>What you will learn</h2></div>
                <ul className="career-bullet-list">{role.learn.map(item => <li key={item}>{item}</li>)}</ul>
              </section>

              <section id="projects" className="career-copy-section">
                <div className="career-section-heading"><span>05 / Practice</span><h2>Example learning projects</h2></div>
                <ul className="career-bullet-list">{role.projects.map(item => <li key={item}>{item}</li>)}</ul>
              </section>

              <section id="requirements" className="career-copy-section">
                <div className="career-section-heading"><span>06 / Basics</span><h2>Minimum requirements</h2></div>
                <ul className="career-bullet-list">
                  <li>You are at least 18 and currently enrolled in an educational program.</li>
                  <li><strong>No prior startup or professional experience is required.</strong></li>
                  {role.requirements.map(item => <li key={item}>{item}</li>)}
                  <li>You communicate when you are stuck and follow through on agreed learning sessions.</li>
                  <li>You can handle customer information respectfully and keep non-public material confidential.</li>
                </ul>
              </section>

              <section id="program-details" className="career-copy-section">
                <div className="career-section-heading"><span>07 / Logistics</span><h2>Program details</h2></div>
                <div className="career-program-grid">
                  <div><span>Location</span><strong>Fully remote</strong></div>
                  <div><span>Office days</span><strong>None required</strong></div>
                  <div><span>Duration</span><strong>8-12 weeks</strong></div>
                  <div><span>Time</span><strong>8-12 hours/week</strong></div>
                  <div><span>Experience</span><strong>None required</strong></div>
                  <div><span>Compensation</span><strong>Unpaid</strong></div>
                </div>
                <p className="career-disclosure">This internship is educational and limited in duration. It does not promise or guarantee employment. School credit is supported when your institution permits it, and participation remains subject to school requirements and applicable law where you live.</p>
              </section>
            </div>
          </div>

          <section id="apply" className="career-job-application">
            <div className="career-application-heading">
              <div className="t-eyebrow c-accent">Application</div>
              <h2>Apply for this internship.</h2>
              <p>We care more about curiosity, careful thinking, and follow-through than a polished resume. This application is specific to the {role.title} position.</p>
            </div>
            <ApplicationForm roleKey={role.key} roleTitle={role.title} roleQuestion={role.applicationQuestion} />
          </section>
        </article>
      </main>
      <MarketingFooter />
    </div>
  )
}
