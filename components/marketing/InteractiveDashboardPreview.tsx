'use client'

import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import {
  IconAlert,
  IconArrowRight,
  IconBook,
  IconCard,
  IconCheck,
  IconChevDown,
  IconCog,
  IconLock,
  IconMessage,
  IconRefresh,
  IconSend,
  IconStar,
  IconUsers,
} from '@/components/icons'
import { sampleCampaign, deliveredRate } from '@/lib/sampleCampaign'
import styles from './InteractiveDashboardPreview.module.css'

type PreviewFeature = 'feedback' | 'playbook' | 'integrations'
type PreviewView =
  | 'tap'
  | 'reviews'
  | 'insights'
  | 'competitors'
  | 'reviewRequests'
  | 'procedures'
  | 'review'
  | 'tasks'
  | 'google'
  | 'youtube'
  | 'billing'
  | 'settings'
type IconComponent = ComponentType<{ s?: number; sw?: number }>
type Tone = 'professional' | 'warm' | 'brief'

type NavItem = {
  view: PreviewView
  label: string
  Icon: IconComponent
  count?: number
}

const FEATURES: Array<{
  id: PreviewFeature
  label: string
  description: string
  Icon: IconComponent
  defaultView: PreviewView
}> = [
  { id: 'feedback', label: 'Customer Feedback', description: 'Reviews and insights', Icon: IconMessage, defaultView: 'tap' },
  { id: 'playbook', label: 'Business Playbook', description: 'Procedures and tasks', Icon: IconBook, defaultView: 'procedures' },
  { id: 'integrations', label: 'Integrations', description: 'Connected services', Icon: IconCog, defaultView: 'google' },
]

const NAV_ITEMS: Record<PreviewFeature, NavItem[]> = {
  feedback: [
    { view: 'tap', label: 'Private feedback', Icon: IconMessage },
    { view: 'reviews', label: 'Reviews', Icon: IconMessage, count: 3 },
    { view: 'insights', label: 'Feedback insights', Icon: IconAlert },
    { view: 'competitors', label: 'Competitors', Icon: IconUsers },
    { view: 'reviewRequests', label: 'Review requests', Icon: IconSend },
  ],
  playbook: [
    { view: 'procedures', label: 'All procedures', Icon: IconBook },
    { view: 'review', label: 'Needs action', Icon: IconAlert, count: 2 },
    { view: 'tasks', label: 'Tasks', Icon: IconUsers },
  ],
  integrations: [
    { view: 'google', label: 'Google Business Profile', Icon: IconCog },
    { view: 'youtube', label: 'YouTube Studio', Icon: IconSend },
  ],
}

const VIEW_LABELS: Record<PreviewView, string> = {
  tap: 'Private feedback',
  reviews: 'Review center',
  insights: 'Feedback insights',
  competitors: 'Competitor tracking',
  reviewRequests: 'Review requests',
  procedures: 'All procedures',
  review: 'Needs action',
  tasks: 'Playbook tasks',
  google: 'Google Business Profile',
  youtube: 'YouTube Studio',
  billing: 'Billing',
  settings: 'Settings',
}

const TONE_COPY: Record<Tone, string> = {
  professional: 'Hi Marcus, I am glad the repair went well, but I am sorry we missed the pickup time and did not keep you updated. We are reviewing that handoff with our team.',
  warm: 'Marcus, thank you for calling this out. You deserved a clear pickup update, and we are sorry we left you waiting. We are fixing that handoff with our team.',
  brief: 'Marcus, we are sorry we missed your pickup time and did not update you. We are fixing that handoff with our team.',
}

function featureForView(view: PreviewView): PreviewFeature {
  if (view === 'procedures' || view === 'review' || view === 'tasks') return 'playbook'
  if (view === 'google' || view === 'youtube' || view === 'settings' || view === 'billing') return 'integrations'
  return 'feedback'
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d={collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} />
    </svg>
  )
}

function AssistantIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4.5 3v-3H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  )
}

function ViewHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <header className={styles.viewHeader}>
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  )
}

function StatCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'positive' | 'attention' | 'gold' }) {
  return (
    <article className={styles.statCard} data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function AnimatedTrend() {
  const points = [
    [28, 118, 'Oct 8', '9 records'],
    [104, 92, 'Oct 15', '14 records'],
    [180, 105, 'Oct 22', '11 records'],
    [256, 68, 'Oct 29', '18 records'],
    [332, 76, 'Nov 5', '16 records'],
    [408, 38, 'Nov 12', '24 records'],
  ] as const

  return (
    <div className={styles.trendChart}>
      <div className={styles.chartLegend}><span><i /> Feedback volume</span><strong>+14.3%</strong></div>
      <svg viewBox="0 0 438 156" role="img" aria-labelledby="preview-trend-title preview-trend-desc">
        <title id="preview-trend-title">Six-week synthetic feedback trend</title>
        <desc id="preview-trend-desc">Feedback volume rises from nine to twenty-four records.</desc>
        {[32, 68, 104, 140].map(y => <line key={y} x1="28" x2="408" y1={y} y2={y} className={styles.chartGrid} />)}
        <path className={styles.chartArea} d="M28 118 C66 107 67 93 104 92 S143 105 180 105 S218 74 256 68 S295 75 332 76 S371 45 408 38 L408 140 L28 140 Z" />
        <path pathLength="1" className={styles.chartLine} d="M28 118 C66 107 67 93 104 92 S143 105 180 105 S218 74 256 68 S295 75 332 76 S371 45 408 38" />
        {points.map(([x, y, date, value]) => (
          <g key={date} className={styles.chartPoint} tabIndex={0} aria-label={`${date}: ${value}`}>
            <circle cx={x} cy={y} r="7" className={styles.chartPointHalo} />
            <circle cx={x} cy={y} r="3.5" />
            <title>{date}: {value}</title>
          </g>
        ))}
      </svg>
      <div className={styles.chartAxis}><span>Oct 8</span><span>Oct 22</span><span>Nov 5</span><span>Nov 12</span></div>
    </div>
  )
}

function ReviewsView({ tone, setTone, filter, setFilter, refreshed, onRefresh }: {
  tone: Tone
  setTone: (tone: Tone) => void
  filter: 'awaiting' | 'replied' | 'all'
  setFilter: (filter: 'awaiting' | 'replied' | 'all') => void
  refreshed: boolean
  onRefresh: () => void
}) {
  return (
    <div className={styles.viewPage}>
      <ViewHeader
        eyebrow="Customer feedback · Synthetic workspace"
        title="Northstar Auto Care"
        description="Review customer feedback, compare drafts, and decide what deserves action."
        action={<button type="button" className={styles.secondaryButton} onClick={onRefresh}><IconRefresh s={13} />{refreshed ? 'Sample refreshed' : 'Refresh sample'}</button>}
      />
      <div className={styles.safeBanner}><span><i /> Interactive sample data</span><small>No customer records are loaded and nothing can be posted to Google.</small></div>
      <section className={styles.statsGrid} aria-label="Synthetic reputation summary">
        <StatCard label="Replova score" value="86" detail="+4.2 week over week" tone="positive" />
        <StatCard label="Google rating" value="4.7" detail="Last 90 days" tone="gold" />
        <StatCard label="New reviews" value="18" detail="This month" />
        <StatCard label="Awaiting reply" value="3" detail="Needs attention" tone="attention" />
      </section>
      <div className={styles.reviewGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div><span>Review queue</span><h3>Recent reviews</h3></div>
            <div className={styles.segmented} aria-label="Review status filter">
              {(['awaiting', 'replied', 'all'] as const).map(item => (
                <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === 'awaiting' ? 'Awaiting' : item === 'replied' ? 'Replied' : 'All'}</button>
              ))}
            </div>
          </header>
          {filter !== 'replied' ? (
            <article className={styles.reviewCard}>
              <div className={styles.reviewMeta}>
                <span className={styles.avatar}>MT</span>
                <div><strong>Marcus Thompson</strong><span className={styles.stars}><IconStar s={9} /><IconStar s={9} /> <i>2.0 · 42 min ago</i></span></div>
                <em>Needs reply</em>
              </div>
              <p>The repair was done well, but I waited almost forty minutes past the pickup time and nobody called with an update.</p>
              <div className={styles.draftCard}>
                <div className={styles.toneTabs} role="tablist" aria-label="Reply tone">
                  {(['professional', 'warm', 'brief'] as const).map(item => <button key={item} type="button" role="tab" aria-selected={tone === item} onClick={() => setTone(item)}>{item}</button>)}
                </div>
                <p>{TONE_COPY[tone]}</p>
                <footer><span><IconLock s={10} /> Owner approval required</span><button type="button">Review draft <IconArrowRight s={10} /></button></footer>
              </div>
            </article>
          ) : null}
          {filter !== 'awaiting' ? (
            <article className={styles.reviewCard}>
              <div className={styles.reviewMeta}>
                <span className={styles.avatar}>EV</span>
                <div><strong>Elena Vasquez</strong><span className={styles.stars}>{[1,2,3,4,5].map(value => <IconStar key={value} s={9} />)} <i>5.0 · 2 hours ago</i></span></div>
                <em data-tone="positive">Positive</em>
              </div>
              <p>Maya explained every option clearly and never pressured me into extra work. I will absolutely come back.</p>
            </article>
          ) : null}
        </section>
        <aside className={styles.panel}>
          <header className={styles.panelHeader}><div><span>Queue health</span><h3>Today</h3></div></header>
          <div className={styles.queueScore}><strong>94%</strong><span>Response rate</span><i><b /></i></div>
          <dl className={styles.metricList}>
            <div><dt>Urgent reviews</dt><dd data-tone="attention">1</dd></div>
            <div><dt>Average response</dt><dd>2h 18m</dd></div>
            <div><dt>Positive sentiment</dt><dd data-tone="positive">82%</dd></div>
          </dl>
          <div className={styles.scopeNote}><strong>Owner-controlled</strong><p>Drafts stay private until an authenticated owner explicitly approves a reply.</p></div>
        </aside>
      </div>
    </div>
  )
}

function InsightsView() {
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Customer feedback intelligence" title="What customers are telling you" description="See patterns, evidence, and operational opportunities across synthetic feedback." />
      <section className={styles.statsGrid} aria-label="Synthetic feedback metrics">
        <StatCard label="Feedback records" value="92" detail="Across six weeks" />
        <StatCard label="Positive sentiment" value="82%" detail="Up 6 points" tone="positive" />
        <StatCard label="Needs recovery" value="4" detail="Owner follow-up" tone="attention" />
        <StatCard label="Open tasks" value="5" detail="2 due this week" />
      </section>
      <div className={styles.insightGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><span>Feedback trend</span><h3>Six-week volume</h3></div><small>Synthetic records</small></header>
          <AnimatedTrend />
        </section>
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><span>Recurring themes</span><h3>What changed</h3></div></header>
          <div className={styles.themeBars}>
            <div><span>Communication</span><i><b style={{ width: '88%' }} /></i><strong>24</strong></div>
            <div><span>Wait times</span><i><b style={{ width: '63%' }} /></i><strong>17</strong></div>
            <div><span>Estimate clarity</span><i><b style={{ width: '48%' }} /></i><strong>13</strong></div>
            <div><span>Repair quality</span><i><b style={{ width: '78%' }} /></i><strong>21</strong></div>
          </div>
        </section>
      </div>
      <section className={styles.priorityGrid} aria-label="Improvement priorities">
        <article><span>01 · High priority</span><h3>Make service updates predictable</h3><p>Customers value the work but mention unclear timing in 12 feedback records.</p><small>12 evidence records</small></article>
        <article><span>02 · Medium priority</span><h3>Set expectations at drop-off</h3><p>Explain when the next update will arrive before the customer leaves.</p><small>8 evidence records</small></article>
        <article><span>03 · Opportunity</span><h3>Scale what Maya does well</h3><p>Turn clear, pressure-free explanations into a shared team procedure.</p><small>7 staff mentions</small></article>
      </section>
    </div>
  )
}

function CompetitorsView() {
  const rows = [
    ['1', 'Northstar Auto Care', '4.7', '386', 'You'],
    ['2', 'Harbor Service Garage', '4.6', '412', '-0.1'],
    ['3', 'Juniper Motor Works', '4.4', '271', '-0.3'],
    ['4', 'Parkline Automotive', '4.2', '198', '-0.5'],
  ]
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Local reputation intelligence" title="Competitor tracking" description="Compare public rating signals without mixing them into private customer feedback." action={<button type="button" className={styles.secondaryButton}>Auto-discover nearby</button>} />
      <div className={styles.competitorSummary}><span>#1</span><div><strong>Your sample workspace leads this comparison</strong><p>Northstar Auto Care ranks first among four tracked businesses.</p></div><dl><div><dt>Rating</dt><dd>4.7</dd></div><div><dt>Reviews</dt><dd>386</dd></div></dl></div>
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><span>Comparison table</span><h3>Nearby businesses</h3></div><small>3 of 5 slots used</small></header>
        <div className={styles.dataTable} role="table" aria-label="Synthetic competitor comparison">
          <div role="row"><span>Rank</span><span>Business</span><span>Rating</span><span>Reviews</span><span>vs. you</span></div>
          {rows.map(row => <div role="row" key={row[1]} data-current={row[4] === 'You'}>{row.map((cell, index) => <span key={`${row[1]}-${index}`}>{cell}</span>)}</div>)}
        </div>
      </section>
    </div>
  )
}

function ReviewRequestsView() {
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Customer outreach" title="Review requests" description="Track permission-based request campaigns. Sending is disabled in this public preview." action={<button type="button" className={styles.primaryButton} disabled>Send all (12)</button>} />
      <section className={styles.statsGrid} aria-label="Synthetic request metrics">
        <StatCard label="Sent" value={String(sampleCampaign.sent)} detail={sampleCampaign.delivered + ' delivered'} />
        <StatCard label="Opened" value={String(sampleCampaign.opened)} detail={deliveredRate(sampleCampaign.opened, sampleCampaign.delivered) + ' of delivered'} tone="positive" />
        <StatCard label="Clicked" value={String(sampleCampaign.clicked)} detail="Customer action" />
        <StatCard label="Click rate" value={deliveredRate(sampleCampaign.clicked, sampleCampaign.delivered)} detail="Of delivered" />
      </section>
      <div className={styles.requestGrid}>
        <section className={styles.panel}><header className={styles.panelHeader}><div><span>Upload contacts</span><h3>CSV import</h3></div></header><div className={styles.dropZone}><IconSend s={18} /><strong>Drop a CSV here</strong><p>Columns: name, email. Preview controls never upload a file.</p><button type="button">Choose sample file</button></div></section>
        <section className={styles.panel}><header className={styles.panelHeader}><div><span>Recent requests</span><h3>Campaign activity</h3></div></header><div className={styles.simpleRows}><div><span>Jordan Lee</span><small>Opened · Nov 12</small></div><div><span>Priya Shah</span><small>Clicked · Nov 11</small></div><div><span>Sam Rivera</span><small>Pending · Not sent</small></div></div></section>
      </div>
    </div>
  )
}

function ProceduresView() {
  return (
    <div className={`${styles.viewPage} ${styles.playbookPage}`}>
      <ViewHeader eyebrow="Business Playbook" title="Procedures" description="Turn approved feedback improvements into clear, versioned operating procedures." action={<button type="button" className={styles.primaryButton}>New procedure</button>} />
      <div className={styles.documentGrid}>
        <aside className={styles.procedureList}>
          <div><span>4 procedures</span><button type="button" aria-label="Search procedures">⌕</button></div>
          <button type="button" aria-current="page"><small>Customer communication</small><strong>Service status updates</strong><span>Active · v3</span></button>
          <button type="button"><small>Front desk</small><strong>Pickup handoff</strong><span>Active · v2</span></button>
          <button type="button"><small>Service quality</small><strong>Estimate walkthrough</strong><span>Draft · v1</span></button>
          <button type="button"><small>Customer recovery</small><strong>Delayed service follow-up</strong><span>Active · v4</span></button>
        </aside>
        <article className={styles.documentReader}>
          <header><div><span>Customer communication</span><h3>Service status updates</h3><p>Version 3 · Updated Nov 12</p></div><button type="button">•••</button></header>
          <section><span>Objective</span><p>Give every customer a clear next-update time while their vehicle is in service.</p></section>
          <section><span>Procedure</span><ol><li><b>Confirm the communication channel.</b><p>Ask whether the customer prefers text, phone, or email.</p></li><li><b>Set the next update time.</b><p>Record a specific time before ending the check-in conversation.</p></li><li><b>Send an update even when nothing changed.</b><p>Silence creates uncertainty. Confirm the current status at the promised time.</p></li></ol></section>
          <footer><span>Responsible role</span><strong>Service advisor</strong><button type="button">View version history</button></footer>
        </article>
      </div>
    </div>
  )
}

function ProposalReviewView({ state, onApprove, onApply }: { state: 'pending' | 'approved' | 'applied'; onApprove: () => void; onApply: () => void }) {
  return (
    <div className={`${styles.viewPage} ${styles.playbookPage}`}>
      <ViewHeader eyebrow="Business Playbook" title="Needs action" description="Review evidence first, then approve and apply as separate owner decisions." />
      <div className={styles.proposalLayout}>
        <section className={styles.panel}>
          <header className={styles.panelHeader}><div><span>Suggested improvement · High priority</span><h3>Make service updates predictable</h3></div><em>{state === 'applied' ? 'Applied' : state === 'approved' ? 'Approved' : 'Awaiting review'}</em></header>
          <div className={styles.proposalBody}><span>Observed problem</span><p>Customers value the repair quality, but recurring feedback points to missed timing updates and uncertainty during longer jobs.</p><span>Proposed change</span><p>Add a required “next update time” step to the Service status updates procedure.</p><span>Expected benefit</span><p>Reduce uncertainty and make handoffs easier for both customers and service advisors.</p></div>
          <footer className={styles.reviewActions}><span><IconLock s={11} /> Nothing changes until the owner acts.</span><div>{state === 'pending' ? <button type="button" className={styles.secondaryButton} onClick={onApprove}>Approve suggestion</button> : null}{state === 'approved' ? <button type="button" className={styles.primaryButton} onClick={onApply}>Apply to Playbook</button> : null}{state === 'applied' ? <button type="button" className={styles.secondaryButton}>Open version 4</button> : null}</div></footer>
        </section>
        <aside className={styles.panel}>
          <header className={styles.panelHeader}><div><span>Evidence</span><h3>12 feedback records</h3></div></header>
          <div className={styles.evidenceList}><button type="button"><span>Google review · 2 stars</span><p>“I was not sure when I would hear back.”</p></button><button type="button"><span>Private feedback · 6/10</span><p>“The repair was right; the updates were late.”</p></button><button type="button"><span>Google review · 3 stars</span><p>“A quick status text would have helped.”</p></button></div>
        </aside>
      </div>
    </div>
  )
}

function TasksView({ completed, toggleTask }: { completed: boolean[]; toggleTask: (index: number) => void }) {
  const tasks = [
    ['Train advisors on next-update times', 'Service advisor · Due Nov 18', 'High'],
    ['Mark overnight parking spaces and update the key-box instructions', 'Riverside operations lead · Due Nov 20', 'Medium'],
    ['Review pickup handoff after two weeks', 'Owner · Due Dec 2', 'Medium'],
  ]
  const percent = Math.round((completed.filter(Boolean).length / tasks.length) * 100)
  return (
    <div className={`${styles.viewPage} ${styles.playbookPage}`}>
      <ViewHeader eyebrow="Business Playbook" title="Tasks" description="Track the work that turns an approved procedure into a repeatable team habit." action={<button type="button" className={styles.primaryButton}>New task</button>} />
      <div className={styles.taskProgress}><div><span>Implementation progress</span><strong>{percent}%</strong></div><i><b style={{ width: `${percent}%` }} /></i><small>{completed.filter(Boolean).length} of {tasks.length} synthetic tasks complete</small></div>
      <section className={styles.panel}>
        <header className={styles.panelHeader}><div><span>Open work</span><h3>Riverside handoff improvements</h3></div><small>3 tasks</small></header>
        <div className={styles.taskList}>{tasks.map((task, index) => <button key={task[0]} type="button" onClick={() => toggleTask(index)} data-complete={completed[index]}><span className={styles.taskCheck}>{completed[index] ? <IconCheck s={12} /> : null}</span><div><strong>{task[0]}</strong><small>{task[1]}</small></div><em>{task[2]}</em></button>)}</div>
      </section>
    </div>
  )
}

function GoogleView() {
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Integrations" title="Google Business Profile" description="Connection controls stay gated until the workspace has valid authorization." />
      <div className={styles.integrationBanner}><IconLock s={16} /><div><strong>Public preview: connection disabled</strong><p>This sample never requests OAuth access, synchronizes reviews, or publishes replies.</p></div></div>
      <div className={styles.integrationGrid}>
        <section className={styles.panel}><header className={styles.panelHeader}><div><span>Connection</span><h3>Business Profile</h3></div><em>Not connected</em></header><div className={styles.integrationBody}><span className={styles.integrationMark}>G</span><div><strong>Connect an authorized Google Business Profile</strong><p>Choose a location only after the business owner grants access.</p></div><button type="button" disabled>Connect Google</button></div></section>
        <section className={styles.panel}><header className={styles.panelHeader}><div><span>Sync controls</span><h3>Review workflow</h3></div></header><div className={styles.settingRows}><div><span>Review synchronization</span><em>Disabled</em></div><div><span>Reply publishing</span><em>Owner approval</em></div><div><span>Last successful sync</span><em>Not available</em></div></div></section>
      </div>
    </div>
  )
}

function YouTubeView({ tab, setTab }: { tab: string; setTab: (tab: string) => void }) {
  const tabs = ['Overview', 'Videos', 'Playlists', 'Reply queue']
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Integrations" title="YouTube Studio" description="A secondary, owner-controlled workflow for video comments and draft replies." action={<span className={styles.disabledStatus}><i /> Publishing off</span>} />
      <div className={styles.youtubeTabs} role="tablist" aria-label="YouTube preview sections">{tabs.map(item => <button type="button" key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
      <div className={styles.youtubeGrid}>
        <section className={styles.panel}><header className={styles.panelHeader}><div><span>{tab}</span><h3>{tab === 'Reply queue' ? 'Comments awaiting approval' : 'Channel workspace'}</h3></div></header><div className={styles.videoPlaceholder}><span>▶</span><div><strong>{tab === 'Reply queue' ? '2 reply drafts need review' : 'Connected channel preview'}</strong><p>Unattended publishing remains disabled. Every public action requires explicit approval.</p></div></div></section>
        <aside className={styles.panel}><header className={styles.panelHeader}><div><span>Safety</span><h3>Publishing controls</h3></div></header><div className={styles.settingRows}><div><span>Automatic replies</span><em>Off</em></div><div><span>Draft generation</span><em>Manual</em></div><div><span>Public preview access</span><em>Read only</em></div></div></aside>
      </div>
    </div>
  )
}

function BillingView() {
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Account" title="Billing" description="Review plan limits and usage. Checkout controls are disabled in this public preview." />
      <div className={styles.currentPlan}><div><span>Current sample plan</span><strong>Growth</strong><p>$99 / month · 5 locations · 5 competitor slots per location</p></div><em>Sample only</em></div>
      <section className={styles.planGrid} aria-label="Plan comparison"><article><span>Starter</span><strong>$39</strong><p>1 location · 3 competitor slots</p><button type="button" disabled>Choose Starter</button></article><article data-current><span>Growth</span><strong>$99</strong><p>5 locations · intelligence and Playbooks</p><button type="button" disabled>Current plan</button></article><article><span>Agency</span><strong>$199</strong><p>15 locations · custom persona and branding</p><button type="button" disabled>Choose Agency</button></article></section>
      <div className={styles.usagePanel}><div><span>Locations</span><strong>1 / 5</strong></div><i><b style={{ width: '20%' }} /></i><div><span>Competitors tracked</span><strong>3 / 5</strong></div><i><b style={{ width: '60%' }} /></i></div>
    </div>
  )
}

function SettingsView({ alerts, setAlerts }: { alerts: boolean; setAlerts: (value: boolean) => void }) {
  return (
    <div className={styles.viewPage}>
      <ViewHeader eyebrow="Account" title="Settings" description="Preview workspace, reply, alert, and account controls without saving data." />
      <section className={styles.settingsPanel}>
        <div><div><strong>Reply settings</strong><p>Keep every generated reply owner-controlled.</p></div><span>Manual approval</span></div>
        <div><div><strong>Low-rating alerts</strong><p>Notify the owner when synthetic feedback is at or below 2 stars.</p></div><button type="button" className={styles.toggle} aria-pressed={alerts} onClick={() => setAlerts(!alerts)}><i /></button></div>
        <div><div><strong>Reply voice</strong><p>Clear, calm, accountable, and specific.</p></div><button type="button">Edit sample</button></div>
        <div><div><strong>Workspace account</strong><p>demo@sample.replova.app</p></div><span>Read only</span></div>
      </section>
    </div>
  )
}

function AssistantPanel({ view, onClose, onNavigate }: { view: PreviewView; onClose: () => void; onNavigate: (view: PreviewView) => void }) {
  const suggestions = useMemo<Array<[string, PreviewView]>>(() => {
    if (featureForView(view) === 'playbook') return [
      ['Review feedback evidence', 'insights' as PreviewView],
      ['Open suggestions needing action', 'review' as PreviewView],
      ['Check implementation tasks', 'tasks' as PreviewView],
    ]
    if (view === 'insights') return [
      ['Show recurring feedback themes', 'insights' as PreviewView],
      ['Open the Playbook proposal', 'review' as PreviewView],
      ['Review the recovery queue', 'reviews' as PreviewView],
    ]
    return [
      ['Review feedback priorities', 'insights' as PreviewView],
      ['Work the review queue', 'reviews' as PreviewView],
      ['Open the synthetic Playbook', 'procedures' as PreviewView],
    ]
  }, [view])

  return (
    <aside className={styles.assistantPanel} aria-label="Ask Replova">
      <header><div><strong>Ask Replova</strong><span>Guided workspace actions</span></div><button type="button" onClick={onClose} aria-label="Close Ask Replova">×</button></header>
      <div className={styles.assistantBody}>
        <section className={styles.assistantContext}><div><span>Current context</span><strong>{VIEW_LABELS[view]}</strong></div><p>Synthetic workspace</p></section>
        <section className={styles.assistantSuggestions}><div><h3>How can I help?</h3><p>Choose an action grounded in the sample records available in this preview.</p></div><nav aria-label="Ask Replova suggestions">{suggestions.map(([label, target]) => <button type="button" key={label} onClick={() => onNavigate(target)}><span className={styles.suggestionLogo}><ReplovaLogo variant="icon" surface="dark" height={12} decorative /></span><span><strong>{label}</strong><small>Open the relevant safe preview.</small></span><IconArrowRight s={12} /></button>)}</nav></section>
      </div>
      <footer><span>Evidence-first actions</span><p>Ask Replova only navigates this synthetic preview. It does not contact customers or publish content.</p></footer>
    </aside>
  )
}

type InteractiveDashboardPreviewProps = {
  variant?: 'hero' | 'page'
  defaultAssistantOpen?: boolean
}

export default function InteractiveDashboardPreview({
  variant = 'hero',
  defaultAssistantOpen = false,
}: InteractiveDashboardPreviewProps) {
  const previewRef = useRef<HTMLElement>(null)
  const [view, setView] = useState<PreviewView>('tap')
  useEffect(() => {
    function readView() {
      const value = new URLSearchParams(window.location.search).get('view')
      setView(value && Object.hasOwn(VIEW_LABELS, value) ? value as PreviewView : 'tap')
    }
    readView()
    window.addEventListener('popstate', readView)
    return () => window.removeEventListener('popstate', readView)
  }, [])
  const [featureMenuOpen, setFeatureMenuOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(defaultAssistantOpen)
  const [navigationCollapsed, setNavigationCollapsed] = useState(false)
  const [tone, setTone] = useState<Tone>('professional')
  const [filter, setFilter] = useState<'awaiting' | 'replied' | 'all'>('all')
  const [refreshed, setRefreshed] = useState(false)
  const [proposalState, setProposalState] = useState<'pending' | 'approved' | 'applied'>('pending')
  const [completedTasks, setCompletedTasks] = useState([true, false, false])
  const [youtubeTab, setYoutubeTab] = useState('Overview')
  const [alerts, setAlerts] = useState(true)
  const activeFeature = featureForView(view)
  const feature = FEATURES.find(item => item.id === activeFeature) ?? FEATURES[0]

  useEffect(() => {
    if (!defaultAssistantOpen || !previewRef.current) return

    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width <= 690) setAssistantOpen(false)
    })

    observer.observe(previewRef.current)
    return () => observer.disconnect()
  }, [defaultAssistantOpen])

  function navigate(nextView: PreviewView) {
    if (variant === 'page') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', nextView)
      window.history.pushState(null, '', url)
    }
    setView(nextView)
    setFeatureMenuOpen(false)
    setAccountMenuOpen(false)
  }

  function renderView() {
    if (view === 'tap') return <div className={styles.viewPage}>
      <ViewHeader eyebrow="Northstar Auto Care · Riverside · July to September" title="Private visit feedback" description="Two of the twelve submissions mention overnight parking." />
      <article className={styles.panel}><header className={styles.panelHeader}><h3>After-hours drop-off</h3></header>
        <div className={styles.proposalBody}><p>“I found the key box, but I couldn’t tell where to leave my car.”</p><p>“I circled the lot looking for the overnight spaces.”</p>
          <button className={styles.secondaryButton} type="button" onClick={() => navigate('tasks')}>Open the parking Playbook action</button>
        </div>
      </article>
    </div>
    if (view === 'reviews') return <ReviewsView tone={tone} setTone={setTone} filter={filter} setFilter={setFilter} refreshed={refreshed} onRefresh={() => setRefreshed(true)} />
    if (view === 'insights') return <InsightsView />
    if (view === 'competitors') return <CompetitorsView />
    if (view === 'reviewRequests') return <ReviewRequestsView />
    if (view === 'procedures') return <ProceduresView />
    if (view === 'review') return <ProposalReviewView state={proposalState} onApprove={() => setProposalState('approved')} onApply={() => setProposalState('applied')} />
    if (view === 'tasks') return <TasksView completed={completedTasks} toggleTask={index => setCompletedTasks(current => current.map((value, itemIndex) => itemIndex === index ? !value : value))} />
    if (view === 'google') return <GoogleView />
    if (view === 'youtube') return <YouTubeView tab={youtubeTab} setTab={setYoutubeTab} />
    if (view === 'billing') return <BillingView />
    return <SettingsView alerts={alerts} setAlerts={setAlerts} />
  }

  return (
    <section
      ref={previewRef}
      className={styles.preview}
      data-variant={variant}
      data-assistant-open={assistantOpen}
      data-navigation-collapsed={navigationCollapsed}
      aria-label="Interactive synthetic Replova dashboard preview"
    >
      <aside className={styles.sidebar} aria-label="Dashboard preview navigation">
        <button type="button" className={styles.brand} onClick={() => navigate('reviews')} aria-label="Open review center">
          <ReplovaLogo className={styles.brandFull} variant="primary" surface="light" height={20} decorative eager />
          <ReplovaLogo className={styles.brandIcon} variant="icon" surface="light" height={20} decorative eager />
        </button>
        <div className={styles.workspaceCard}><span>N</span><div><strong>Northstar Auto Care</strong><small>1 location · Growth</small></div></div>
        <div className={styles.featureSwitcher}>
          <small>Feature</small>
          <button type="button" className={styles.featureButton} aria-label={'Switch feature: ' + feature.label} aria-haspopup="menu" aria-expanded={featureMenuOpen} onClick={() => setFeatureMenuOpen(open => !open)}><span className={styles.featureIcon}><feature.Icon s={14} /></span><span><strong>{feature.label}</strong><small>{feature.description}</small></span><IconChevDown s={12} /></button>
          {featureMenuOpen ? <div className={styles.featureMenu} role="menu">{FEATURES.map(item => <button type="button" role="menuitem" key={item.id} aria-current={item.id === activeFeature ? 'true' : undefined} onClick={() => navigate(item.defaultView)}><span><strong>{item.label}</strong><small>{item.description}</small></span>{item.id === activeFeature ? <i /> : null}</button>)}</div> : null}
        </div>
        <nav className={styles.nav}><small>{feature.label}</small>{NAV_ITEMS[activeFeature].map(item => <button type="button" key={item.view} aria-current={view === item.view ? 'page' : undefined} aria-label={item.label} title={item.label} onClick={() => navigate(item.view)}><span><item.Icon s={14} /></span><strong>{item.label}</strong>{item.count ? <em>{item.count}</em> : null}</button>)}</nav>
        <div className={styles.accountArea}>
          {accountMenuOpen ? <div className={styles.accountMenu} role="menu"><button type="button" role="menuitem" onClick={() => navigate('billing')}><IconCard s={13} />Billing</button><button type="button" role="menuitem" onClick={() => navigate('settings')}><IconCog s={13} />Settings</button></div> : null}
          <button type="button" className={styles.accountButton} aria-haspopup="menu" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen(open => !open)}><span>DE</span><span><strong>Demo workspace</strong><small>Synthetic data</small></span><IconChevDown s={12} /></button>
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div><button type="button" className={styles.collapseButton} aria-label={navigationCollapsed ? 'Expand navigation' : 'Collapse navigation'} aria-pressed={navigationCollapsed} onClick={() => setNavigationCollapsed(collapsed => !collapsed)}><CollapseIcon collapsed={navigationCollapsed} /></button><nav aria-label="Preview breadcrumb"><span>Northstar Auto Care</span><b>›</b><strong>{VIEW_LABELS[view]}</strong></nav></div>
          <div><span className={styles.planLabel}>Growth</span><button type="button" className={styles.assistantToggle} aria-label="Ask Replova" aria-controls="preview-ask-replova" aria-expanded={assistantOpen} onClick={() => setAssistantOpen(open => !open)}><span><AssistantIcon /></span><strong>Ask Replova</strong></button></div>
        </header>
        <section aria-label={VIEW_LABELS[view]} className={styles.content} id="preview-dashboard-content">{renderView()}</section>
      </section>

      {assistantOpen ? <div id="preview-ask-replova" className={styles.assistantSlot}><AssistantPanel view={view} onClose={() => setAssistantOpen(false)} onNavigate={navigate} /></div> : null}
    </section>
  )
}
