import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowIcon, MarketingFooter, MarketingHeader } from '@/components/MarketingChrome'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Practical guides for replying to Google reviews, learning from customer feedback, and building a healthier local reputation.',
  alternates: { canonical: '/resources' },
}

export default function ResourcesPage() {
  return (
    <div className="marketing-page">
      <MarketingHeader />
      <main id="main-content" className="marketing-page-main">
        <section className="subpage-hero">
          <div className="t-eyebrow c-accent">Resource center</div>
          <h1>Make customer feedback useful.</h1>
          <p>Short, practical playbooks for answering reviews well, spotting patterns without overreacting, and asking customers for honest feedback at the right moment.</p>
        </section>

        <div className="page-rule-heading"><h2>Field guides</h2><span>Practical · no gate · built for operators</span></div>
        <div className="resource-list">
          <article id="replying" className="resource-article">
            <span>01</span><div><h2>How to reply to every kind of Google review</h2></div>
            <div>
              <p>A useful reply acknowledges the specific experience, sounds like the business, and gives the customer a clear next step when something went wrong.</p>
              <h3>For positive reviews</h3><ul><li>Name the detail the customer appreciated.</li><li>Keep the response proportional—warm, not overly promotional.</li><li>Thank the team member mentioned without exposing private information.</li></ul>
              <h3>For critical reviews</h3><ul><li>Do not argue facts in public or reveal account details.</li><li>Acknowledge the impact before explaining process.</li><li>Move resolution to a private, specific contact channel.</li><li>Never promise an outcome you have not approved internally.</li></ul>
              <h3>For reviews without text</h3><p>Keep it brief. Thank the reviewer and invite them back; do not invent context that was not provided.</p>
            </div>
          </article>

          <article id="insights" className="resource-article">
            <span>02</span><div><h2>Turn scattered reviews into an operating signal</h2></div>
            <div>
              <p>One review is an experience. A repeated theme is a signal. Look at the direction, frequency, and operational owner before deciding what to change.</p>
              <h3>A simple weekly review</h3><ol><li>Separate urgent recovery work from long-term themes.</li><li>Compare positive and negative mentions of the same topic.</li><li>Check whether the theme is isolated to a day, location, or team handoff.</li><li>Assign one small action and watch the next four weeks.</li></ol>
              <h3>What not to do</h3><p>Do not redesign a process around the loudest single comment. Use the review text, rating trend, response history, and real operational data together.</p>
            </div>
          </article>

          <article id="requests" className="resource-article">
            <span>03</span><div><h2>Ask for reviews without creating pressure</h2></div>
            <div>
              <p>The best request is timely, neutral, and easy to act on. Ask for an honest review after a real interaction—never offer rewards for positive sentiment.</p>
              <h3>Recommended sequence</h3><ol><li>Send after the service or purchase is complete.</li><li>Use the customer&apos;s name and your recognizable business name.</li><li>Link directly to the Google review flow.</li><li>Send at most one considerate reminder.</li><li>Honor opt-outs and keep contact lists limited to real customers.</li></ol>
              <h3>Measure quality, not only volume</h3><p>Monitor delivery, opens, clicks, rating distribution, and the specificity of new feedback. More reviews only help when the request process earns trust.</p>
            </div>
          </article>
        </div>

        <section className="final-cta" style={{ marginTop: 92 }}><div className="final-cta-inner"><div className="t-eyebrow">Put the playbook into practice.</div><h2>Run the whole loop in Replova.</h2><p>Monitor, reply, learn, request, and report from the same workspace.</p><Link href="/demo" className="btn btn-primary btn-lg">Request a demo <ArrowIcon /></Link></div></section>
      </main>
      <MarketingFooter />
    </div>
  )
}
