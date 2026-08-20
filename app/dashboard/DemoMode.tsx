'use client'

import { useState } from 'react'
import CopyButton from './CopyButton'
import PostReplyButton from './PostReplyButton'
import AutoDismissBanner from './AutoDismissBanner'

const DEMO_REVIEWS = [
  {
    id: 'demo-1',
    author: 'Talia R.',
    rating: 2,
    review_text: 'Had a consultation here for Botox. The appointment was rushed, the provider barely looked at my face before recommending a full treatment plan, and I felt pressured to book on the spot. Left feeling uncertain. Will try somewhere else.',
    reply_draft_1: 'Hi Talia, I\'m sorry the consultation felt rushed. You should have had time to ask questions and think through the recommendations without feeling pressured. Please call our office and ask for the practice manager so we can learn more about what happened.',
    reply_draft_2: 'Talia, I\'m sorry you left the consultation feeling uncertain. A treatment plan should come after a careful conversation about your goals, and you should never feel pushed to book. If you\'re open to it, please contact our office so I can follow up with you directly.',
    reply_draft_3: 'Hi Talia, I\'m sorry the consultation felt rushed and pressured. Please contact our office so we can discuss what happened.',
    review_timestamp: Math.floor(Date.now() / 1000) - 7200,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-2',
    author: 'Priya K.',
    rating: 3,
    review_text: 'My Hydrafacial was great and the provider was very thorough, but I waited almost 30 minutes past my appointment time. I wish someone had let me know they were running behind.',
    reply_draft_1: 'Hi Priya, I\'m glad you were happy with the Hydrafacial, but you should not have been left waiting without an update. We\'re reviewing how our front desk communicates delays so clients know what to expect. Thank you for pointing this out.',
    reply_draft_2: 'Priya, I\'m glad the treatment itself went well. I\'m sorry no one kept you updated during the wait. A quick heads-up would have made a difference, and we\'ll address that with our front desk team.',
    reply_draft_3: 'Hi Priya, I\'m glad you liked the Hydrafacial. I\'m sorry about the wait and the lack of an update. We\'ll address it with our team.',
    review_timestamp: Math.floor(Date.now() / 1000) - 86400,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-3',
    author: 'Elena V.',
    rating: 5,
    review_text: 'Maya was wonderful during my first laser treatment. She explained every step, checked in throughout the appointment, and gave me clear aftercare instructions. I already booked my next session.',
    reply_draft_1: 'Thank you, Elena. We\'re glad Maya made your first laser appointment comfortable and explained the aftercare clearly. We\'ll share your note with her, and we look forward to seeing you at your next session.',
    reply_draft_2: 'Elena, thanks for taking the time to mention Maya. She\'s careful about explaining each step, especially for a first appointment. We\'re glad you felt comfortable and will see you at the next session.',
    reply_draft_3: 'Thanks, Elena. We\'re glad Maya made your first laser treatment comfortable and clear. See you at your next session.',
    review_timestamp: Math.floor(Date.now() / 1000) - 172800,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-4',
    author: 'Danielle B.',
    rating: 4,
    review_text: 'Really happy with my facial and the esthetician was excellent. Checkout was hectic though, and it took a while to schedule my follow-up. I\'ll still be back.',
    reply_draft_1: 'Hi Danielle, we\'re glad you enjoyed the facial and your time with the esthetician. I\'m sorry checkout and scheduling took longer than they should have. We\'re looking at that handoff with our front desk team. Thank you for letting us know.',
    reply_draft_2: 'Danielle, thanks for the honest note. It\'s good to hear the facial went well, but checkout should have been much smoother. We\'ll review the scheduling process with the front desk before your next visit.',
    reply_draft_3: 'Thanks, Danielle. We\'re glad you enjoyed the facial, and we\'ll work on making checkout and follow-up scheduling quicker.',
    review_timestamp: Math.floor(Date.now() / 1000) - 259200,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    status: 'drafted',
  },
]

type DemoReview = typeof DEMO_REVIEWS[0]

const REPLY_LABELS = [
  { label: 'Professional', field: 'reply_draft_1' as const },
  { label: 'Warm',         field: 'reply_draft_2' as const },
  { label: 'Brief',        field: 'reply_draft_3' as const },
]

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 11, letterSpacing: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < rating ? '#f59e0b' : 'var(--border-hi)' }}>★</span>
      ))}
    </span>
  )
}

function formatReviewDate(ts: number): string {
  const diff = Date.now() - ts * 1000
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function DemoReviewRow({ review, defaultOpen = false }: { review: DemoReview; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [activeTab, setActiveTab] = useState<'reply_draft_1' | 'reply_draft_2' | 'reply_draft_3'>('reply_draft_1')

  const isLowRating = review.rating <= 2
  const activeText = review[activeTab]

  return (
    <div className={`review-row fade-up ${open ? 'open' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 }}
        >
          <div style={{ flexShrink: 0, width: 58 }}>
            <Stars rating={review.rating} />
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{review.rating}/5</div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{review.author}</span>
              {isLowRating && <span className="badge badge-red">Urgent</span>}
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
                background: 'var(--accent-sub)', color: 'var(--accent)',
                border: '1px solid oklch(0.61 0.2 258 / 0.2)',
                letterSpacing: '0.04em',
              }}>
                DEMO
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {review.review_text.slice(0, 96)}{review.review_text.length > 96 ? '…' : ''}
            </p>
          </div>

          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{formatReviewDate(review.review_timestamp)}</span>
            <svg
              style={{ color: 'var(--t3)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </button>
      </div>

      {open && (
        <div className="fade-in" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {isLowRating && (
            <div style={{ display: 'flex', gap: 12, margin: '16px 0', fontSize: 12 }}>
              <span style={{ color: 'var(--err)', fontWeight: 500 }}>Priority: reply soon</span>
            </div>
          )}

          <div style={{ margin: '16px 0', paddingLeft: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              &ldquo;{review.review_text}&rdquo;
            </p>
          </div>

          <div style={{
            display: 'flex', gap: 4, marginBottom: 12,
            background: 'var(--bg)', borderRadius: 10, padding: 4,
            width: 'fit-content', border: '1px solid var(--border)',
          }}>
            {REPLY_LABELS.map(({ label, field }) => (
              <button
                key={field}
                onClick={() => setActiveTab(field)}
                className={`draft-tab ${activeTab === field ? 'active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--border-md)', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.75, margin: '0 0 14px' }}>{activeText}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
              <CopyButton text={activeText} />
              <PostReplyButton replyText={activeText} reviewId={null} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DemoMode() {
  return (
    <div>
      {/* The demo banner auto-dismisses after 6 seconds to avoid stacking with the success banner */}
      <AutoDismissBanner className="banner banner-amber fade-up" delay={6000}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          This is a preview with sample reviews. Connect your Google Business account to see your real ones.{' '}
          <a href="/dashboard/settings" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
            Connect now
          </a>
        </span>
      </AutoDismissBanner>

      {/* Demo stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Needs reply',   value: '2',    color: 'var(--t1)',  danger: false },
          { label: 'Avg rating',    value: '★ 3.0', color: '#f59e0b',   danger: false },
          { label: 'Response rate', value: '0%',    color: 'var(--t1)',  danger: false },
          { label: 'Urgent',        value: '2',     color: 'var(--err)', danger: true },
        ].map((s, i) => (
          <div
            key={i}
            className="stat-card fade-up"
            style={{
              animationDelay: `${i * 40}ms`,
              ...(s.danger ? { background: 'var(--err-sub)', borderColor: 'rgba(239,68,68,0.2)' } : {}),
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.04em', color: s.color, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Demo tab bar */}
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        <button className="tab-btn active">
          Needs Reply
          <span className="badge badge-zinc" style={{ padding: '1px 6px', fontSize: 10 }}>2</span>
        </button>
        <button className="tab-btn">Completed <span className="badge badge-zinc" style={{ padding: '1px 6px', fontSize: 10 }}>0</span></button>
        <button className="tab-btn">All <span className="badge badge-zinc" style={{ padding: '1px 6px', fontSize: 10 }}>4</span></button>
      </div>

      {/* The first demo review is open by default */}
      {DEMO_REVIEWS.map((review, i) => (
        <DemoReviewRow key={review.id} review={review} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
