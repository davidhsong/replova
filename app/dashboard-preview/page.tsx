import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard Preview',
  description: 'A sample-data preview of the Replova review operations dashboard.',
  robots: { index: false, follow: false },
}

const navItems = [
  ['Review center', 'message'],
  ['Competitors', 'chart'],
  ['Billing', 'card'],
  ['Settings', 'settings'],
] as const

function NavIcon({ name }: { name: string }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'message') return <svg viewBox="0 0 24 24" {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></svg>
  if (name === 'chart') return <svg viewBox="0 0 24 24" {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
  if (name === 'card') return <svg viewBox="0 0 24 24" {...common}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
  if (name === 'settings') return <svg viewBox="0 0 24 24" {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>
  return <svg viewBox="0 0 24 24" {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
}

function ReviewCard({ author, stars, time, tone, children }: { author: string; stars: number; time: string; tone: 'urgent' | 'positive'; children: React.ReactNode }) {
  return (
    <article className="dash-preview-review">
      <div className="dash-preview-review-head">
        <div className="dash-preview-avatar">{author.charAt(0)}</div>
        <div><strong>{author}</strong><span>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)} <i>{time}</i></span></div>
        <em className={tone}>{tone === 'urgent' ? 'Needs reply' : 'Positive'}</em>
      </div>
      <p>{children}</p>
      <div className="dash-preview-draft">
        <div><strong>Professional</strong><span>Warm</span><span>Brief</span></div>
        <p>{tone === 'urgent'
          ? 'Hi Marcus, I am glad the repair went well, but I am sorry we missed the pickup time and did not keep you updated. We are reviewing that handoff with our team.'
          : 'Thank you, Elena. We are so glad Maya made every option feel clear and pressure-free. We appreciate you trusting our team.'}</p>
        <button type="button">Post reply</button>
      </div>
    </article>
  )
}

export default function DashboardPreviewPage() {
  return (
    <main id="main-content" className="dash-preview-page">
      <div className="dash-preview-banner">
        <span><strong>Sample dashboard.</strong> Nothing here connects to customer data or posts to Google.</span>
        <Link href="/signin">Go to secure sign in</Link>
      </div>

      <div className="dash-preview-shell">
        <aside className="dash-preview-sidebar">
          <Link href="/" className="dash-preview-brand"><Image src="/replova-mark.svg" alt="" width={25} height={25} /><span>Replova</span></Link>
          <div className="dash-preview-workspace"><small>Workspace</small><strong>Northstar Auto Care</strong><span>Single location</span></div>
          <nav aria-label="Dashboard preview navigation">
            {navItems.map(([label, icon]) => <span className={label === 'Review center' ? 'active' : ''} key={label}><NavIcon name={icon} />{label}</span>)}
          </nav>
          <div className="dash-preview-user"><span>DH</span><div><strong>David Song</strong><small>Owner</small></div></div>
        </aside>

        <section className="dash-preview-main">
          <header className="dash-preview-topbar">
            <span>Workspace <i>/</i> Review center</span>
            <div><span className="dash-preview-status"><i /> Monitoring</span><Link href="/">Exit preview</Link></div>
          </header>

          <div className="dash-preview-content">
            <div className="dash-preview-title"><div><small>Thursday, November 12</small><h1>Northstar Auto Care</h1></div><button type="button">Sync reviews</button></div>
            <div className="dash-preview-alert"><span><i /> All systems are monitoring your reviews</span><small>Last synced 8 minutes ago</small></div>

            <section className="dash-preview-stats" aria-label="Reputation summary">
              <article><span>Replova score</span><div><strong>86</strong><em>+4.2</em></div><small>Week over week</small></article>
              <article><span>Google rating</span><div><strong>4.7</strong><em className="gold">★</em></div><small>Last 90 days</small></article>
              <article><span>New reviews</span><div><strong>18</strong></div><small>This month</small></article>
              <article className="attention"><span>Awaiting reply</span><div><strong>3</strong></div><small>Needs attention</small></article>
            </section>

            <section className="dash-preview-inbox dash-preview-inbox-simple">
              <div className="dash-preview-section-head"><div><h2>Review inbox</h2><span>25 most recent</span></div><div><button type="button">All status</button><button type="button">All ratings</button><button type="button">Sentiment</button></div></div>
              <ReviewCard author="Marcus Thompson" stars={2} time="42 min ago" tone="urgent">The repair was done well, but I waited almost forty minutes past the pickup time and nobody called with an update.</ReviewCard>
              <ReviewCard author="Elena Vasquez" stars={5} time="2 hours ago" tone="positive">Maya explained every option clearly and never pressured me into extra work. I will absolutely come back.</ReviewCard>
            </section>
          </div>
        </section>
      </div>
    </main>
  )
}
