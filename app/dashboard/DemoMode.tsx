'use client'

import { useState } from 'react'
import CopyButton from './CopyButton'
import PostReplyButton from './PostReplyButton'
import AutoDismissBanner from './AutoDismissBanner'

const DEMO_REVIEWS = [
  {
    id: 'demo-1',
    author: 'Sarah M.',
    rating: 2,
    review_text: 'Had a consultation here for Botox. The appointment was rushed, the provider barely looked at my face before recommending a full treatment plan, and I felt pressured to book on the spot. Left feeling uncertain. Will try somewhere else.',
    reply_draft_1: 'Hi Sarah, thank you for sharing your experience with us. I sincerely apologize. Feeling rushed during your consultation and leaving without clear answers is not the experience we aim to provide. This does not reflect our standards. I would appreciate the opportunity to speak with you directly. Please reach out to us at hello@yourspa.com so we can make this right.',
    reply_draft_2: 'Sarah, I\'m truly sorry your consultation fell so far short. Feeling pressured and uncertain after an appointment is never acceptable. Our goal is always for you to leave feeling informed and confident. We\'d love the opportunity to make this right. Please reach out and we\'ll take care of you properly.',
    reply_draft_3: 'Hi Sarah, this is not the experience we want for our guests and I sincerely apologize. Please contact us directly so we can make this right.',
    review_timestamp: Math.floor(Date.now() / 1000) - 7200,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-2',
    author: 'Maria S.',
    rating: 2,
    review_text: 'The pasta used to be amazing here but something has changed. It tasted bland and overcooked. Service was fine. I really hope they go back to the old recipe.',
    reply_draft_1: 'Hi Maria, thank you for your honest feedback. I\'m sorry to hear the pasta didn\'t meet your expectations. Consistency is something we take seriously, and we\'ve recently updated our prep process. I\'ve passed your feedback directly to our kitchen. We\'d love to have you back and show you we can do better.',
    reply_draft_2: 'Maria, thank you for being a loyal guest and for speaking up. Hearing that something you used to love isn\'t the same is hard, and we take that seriously. Your feedback is going straight to our chef. We\'d love to invite you back for a complimentary bowl to win you over again.',
    reply_draft_3: 'Hi Maria, thank you for the feedback. We\'re looking into the pasta consistency right away. We\'d love to have you back and make it right.',
    review_timestamp: Math.floor(Date.now() / 1000) - 86400,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-3',
    author: 'Sofia L.',
    rating: 5,
    review_text: 'Absolutely the best dinner I\'ve had in months. The tiramisu was out of this world and our server Carlos was so attentive and warm. We celebrated our anniversary here and it was perfect.',
    reply_draft_1: 'Thank you so much, Sofia! It truly means everything to hear that your anniversary dinner was perfect. Carlos will be thrilled to read your kind words, and we\'ll pass them along. The tiramisu is a labour of love and we\'re so glad it made the night special. We hope to see you both again soon.',
    reply_draft_2: 'Sofia, what a wonderful review to read. Thank you! Anniversaries are precious and we\'re so honoured you chose us to celebrate yours. Carlos is one of our favourites and we\'ll make sure he knows. We can\'t wait to welcome you both back.',
    reply_draft_3: 'Thank you, Sofia! So happy your anniversary was perfect. We\'ll be sure to tell Carlos. See you again soon!',
    review_timestamp: Math.floor(Date.now() / 1000) - 172800,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    status: 'drafted',
  },
  {
    id: 'demo-4',
    author: 'Marco R.',
    rating: 4,
    review_text: 'Great food, really solid menu. My only complaint is that it gets very loud on weekends, hard to have a conversation. Would love a quieter corner option. Will definitely return.',
    reply_draft_1: 'Thank you for the kind words, Marco, and for the honest feedback about noise levels on weekends. You\'re right that it gets lively. We\'re actually exploring some acoustic improvements for the dining room. Next time, ask to be seated near the back or in our corner alcove, it\'s noticeably quieter. We look forward to seeing you again.',
    reply_draft_2: 'Marco, thank you! So glad you enjoyed the menu. We love a full house but totally understand wanting to actually hear your dinner companion! Ask us for the back corner next visit, much more peaceful. Can\'t wait to have you back.',
    reply_draft_3: 'Thanks, Marco! Ask for our back corner next time, it\'s much quieter. See you soon!',
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
              <span style={{ color: 'var(--err)', fontWeight: 500 }}>⚠ Prioritise this response</span>
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
      {/* Demo banner — auto-dismisses after 6 s so it doesn't pile up with the success banner */}
      <AutoDismissBanner className="banner banner-amber fade-up" delay={6000}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>
          This is a preview with sample reviews. Connect your Google Business account to see your real ones.{' '}
          <a href="/dashboard/settings" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>
            Connect now →
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

      {/* Demo reviews — first one open by default */}
      {DEMO_REVIEWS.map((review, i) => (
        <DemoReviewRow key={review.id} review={review} defaultOpen={i === 0} />
      ))}
    </div>
  )
}
