'use client'

import { useState, useMemo } from 'react'
import CopyButton from './CopyButton'
import PostReplyButton from './PostReplyButton'

type Review = {
  id: string
  restaurant_id: string
  author: string | null
  rating: number | null
  review_text: string | null
  sentiment_label: string | null
  reply_draft_1: string | null
  reply_draft_2: string | null
  reply_draft_3: string | null
  status: string | null
  review_timestamp: number | null
  replied_at: string | null
  created_at: string
}

const REPLY_LABELS = [
  { label: 'Professional', field: 'reply_draft_1' },
  { label: 'Warm', field: 'reply_draft_2' },
  { label: 'Brief', field: 'reply_draft_3' },
] as const

type SectionTab = 'needs-reply' | 'completed' | 'all'
type RatingFilter = 'all' | '5' | '4' | '3' | '1-2'
type SentimentFilter = 'all' | 'positive' | 'neutral' | 'negative'

const OVERDUE_DAYS = 3

function formatReviewDate(timestamp: number | null): string {
  if (!timestamp) return '-'
  const d = new Date(timestamp * 1000)
  const diff = Date.now() - d.getTime()
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000)return `${Math.floor(diff / 86_400_000)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() > OVERDUE_DAYS * 24 * 60 * 60 * 1000
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'flex', gap: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24"
          fill={i < rating ? 'var(--gold)' : 'none'}
          stroke={i < rating ? 'var(--gold)' : 'var(--line-hi)'}
          strokeWidth="1.5"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </span>
  )
}


function ReviewRow({
  review,
  effectiveStatus,
  onSetStatus,
  sentimentEnabled,
}: {
  review: Review
  effectiveStatus: string | null
  onSetStatus: (status: string) => void
  sentimentEnabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reply_draft_1' | 'reply_draft_2' | 'reply_draft_3'>('reply_draft_1')
  const [toggling, setToggling] = useState(false)

  const isReplied = effectiveStatus === 'replied'
  const isLowRating = review.rating != null && review.rating <= 2
  const isOverdueReview = !isReplied && isOverdue(review.created_at)
  const activeText = review[activeTab]
  const reviewDate = formatReviewDate(review.review_timestamp)

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setToggling(true)
    const previousStatus = effectiveStatus ?? 'drafted'
    const nextStatus = isReplied ? 'drafted' : 'replied'
    onSetStatus(nextStatus)
    const res = await fetch('/api/reviews/mark-replied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId: review.id, completed: !isReplied }),
    })
    if (!res.ok) onSetStatus(previousStatus)
    setToggling(false)
  }

  const initials = (review.author ?? 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const rowBg = isReplied ? 'var(--surface)' :
    review.rating !== null && review.rating <= 2 ? 'var(--neg-sub)' :
    review.rating === 3 ? 'var(--warn-sub)' : 'var(--surface)'

  return (
    <article style={{
      background: rowBg,
      borderTop: '1px solid var(--line)',
      opacity: isReplied ? 0.5 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 }}
        >
          {/* Avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: 'var(--t2)', flexShrink: 0,
          }}>
            {initials}
          </div>

          {/* Author + preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>
                {review.author ?? 'Anonymous'}
              </span>
              {review.rating != null && <Stars rating={review.rating} />}
              {sentimentEnabled && review.sentiment_label && (
                <span className={`pill ${review.sentiment_label === 'positive' ? 'pill-pos' : review.sentiment_label === 'negative' ? 'pill-neg' : ''}`}>
                  {review.sentiment_label.charAt(0).toUpperCase() + review.sentiment_label.slice(1)}
                </span>
              )}
              {isLowRating && !isReplied && <span className="pill pill-neg">Urgent</span>}
              {!isLowRating && isOverdueReview && <span className="pill pill-warn">Overdue</span>}
              {isReplied && (
                <span className="pill pill-pos">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                  Replied
                </span>
              )}
            </div>
            {review.review_text && (
              <p className="t-xs c-t3" style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {review.review_text.slice(0, 100)}{review.review_text.length > 100 ? '…' : ''}
              </p>
            )}
          </div>

          {/* Date + chevron */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span className="t-xs c-t3">{reviewDate}</span>
            <svg
              style={{ color: 'var(--t3)', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </div>
        </button>

        {/* Mark-replied toggle */}
        <div style={{ padding: '0 16px 0 4px', flexShrink: 0 }}>
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={isReplied ? 'Mark as needs reply' : 'Mark as replied'}
            aria-label={isReplied ? 'Mark as needs reply' : 'Mark as replied'}
            className={`check-btn ${isReplied ? 'done' : ''}`}
            style={{ opacity: toggling ? 0.4 : 1 }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="fade-in" style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--line)' }}>
          {/* Context hint */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '14px 0', fontSize: 12 }}>
            {isLowRating && !isReplied && <span style={{ color: 'var(--neg)', fontWeight: 500 }}>⚠ Prioritise this response</span>}
            {!isLowRating && isOverdueReview && <span style={{ color: 'var(--warn)', fontWeight: 500 }}>⏰ Waiting {OVERDUE_DAYS}+ days for a reply</span>}
            {isReplied && <span style={{ color: 'var(--pos)', fontWeight: 500 }}>✓ Already replied on Google</span>}
          </div>

          {/* Full review text — serif italic for negative */}
          {review.review_text ? (
            <div style={{ marginBottom: 16, paddingLeft: 14 }}>
              {isLowRating ? (
                <p className="t-serif t-italic" style={{ fontSize: 17, color: 'var(--t1)', lineHeight: 1.5, margin: 0, letterSpacing: '-0.005em', fontWeight: 400 }}>
                  &ldquo;{review.review_text}&rdquo;
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
                  &ldquo;{review.review_text}&rdquo;
                </p>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic', marginBottom: 16 }}>No review text (rating only).</p>
          )}

          {/* Reply drafts */}
          {(review.reply_draft_1 || review.reply_draft_2 || review.reply_draft_3) ? (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-5)', padding: 16 }}>
              <div className="t-eyebrow" style={{ marginBottom: 12 }}>Suggested reply</div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 12, background: 'var(--surface)', borderRadius: 'var(--r-4)', padding: 3, border: '1px solid var(--line)', width: 'fit-content' }}>
                {REPLY_LABELS.map(({ label, field }) => (
                  <button
                    key={field}
                    onClick={() => setActiveTab(field)}
                    style={{
                      padding: '5px 12px', borderRadius: 'var(--r-3)', fontSize: 11, fontWeight: 600,
                      background: activeTab === field ? 'var(--t1)' : 'transparent',
                      color: activeTab === field ? 'var(--bg)' : 'var(--t3)',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      letterSpacing: '0.02em', transition: 'all 0.1s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeText && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.75, margin: '0 0 14px' }}>{activeText}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      onClick={handleToggle}
                      disabled={toggling}
                      className="btn btn-ghost btn-sm"
                      style={{ opacity: toggling ? 0.4 : 1 }}
                    >
                      {isReplied ? 'Undo replied' : 'Mark as replied'}
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <CopyButton text={activeText} />
                      <PostReplyButton
                        replyText={activeText}
                        reviewId={review.id}
                        onReplied={() => { if (!isReplied) onSetStatus('replied') }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>
                {isReplied ? 'This review was already replied to on Google.' : 'Draft not yet generated.'}
              </p>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className="btn btn-ghost btn-sm"
                style={{ opacity: toggling ? 0.4 : 1 }}
              >
                {isReplied ? 'Undo replied' : 'Mark as replied'}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

const RATING_FILTERS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '5', label: '5★' },
  { value: '4', label: '4★' },
  { value: '3', label: '3★' },
  { value: '1-2', label: '1–2★' },
]

export default function ReviewList({
  reviews,
  currentPage,
  totalPages,
  sentimentEnabled,
}: {
  reviews: Review[]
  currentPage: number
  totalPages: number
  sentimentEnabled: boolean
}) {
  const [tab, setTab] = useState<SectionTab>('needs-reply')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all')
  const [search, setSearch] = useState('')
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({})

  function getStatus(review: Review): string | null {
    return localStatus[review.id] ?? review.status
  }

  function setReviewStatus(reviewId: string, status: string) {
    setLocalStatus(prev => ({ ...prev, [reviewId]: status }))
  }

  const localNeedsReply = reviews.filter(r => getStatus(r) !== 'replied').length
  const localCompleted = reviews.filter(r => getStatus(r) === 'replied').length

  const filtered = useMemo(() => {
    const base = reviews.filter(r => {
      const status = localStatus[r.id] ?? r.status
      if (tab === 'needs-reply' && status === 'replied') return false
      if (tab === 'completed' && status !== 'replied') return false
      if (ratingFilter === '5' && r.rating !== 5) return false
      if (ratingFilter === '4' && r.rating !== 4) return false
      if (ratingFilter === '3' && r.rating !== 3) return false
      if (ratingFilter === '1-2' && (r.rating == null || r.rating > 2)) return false
      if (sentimentEnabled && sentimentFilter !== 'all' && r.sentiment_label !== sentimentFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!(r.author ?? '').toLowerCase().includes(q) && !(r.review_text ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })

    if (tab === 'needs-reply') {
      base.sort((a, b) => {
        const aU = (localStatus[a.id] ?? a.status) !== 'replied' && a.rating != null && a.rating <= 2 ? 0 : 1
        const bU = (localStatus[b.id] ?? b.status) !== 'replied' && b.rating != null && b.rating <= 2 ? 0 : 1
        if (aU !== bU) return aU - bU
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
    }
    return base
  }, [reviews, tab, ratingFilter, sentimentFilter, sentimentEnabled, search, localStatus])

  const tabs: { value: SectionTab; label: string; count: number }[] = [
    { value: 'needs-reply', label: 'Awaiting reply', count: localNeedsReply },
    { value: 'completed',   label: 'Replied',        count: localCompleted },
    { value: 'all',         label: 'All',             count: reviews.length },
  ]

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 0 }}>
        <div className="tabs">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)} className={`tab ${tab === t.value ? 'active' : ''}`}>
              {t.label}
              <span className="tnum c-t4" style={{ marginLeft: 4, fontSize: 11 }}>{t.count}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Rating filter pills */}
          <div style={{
            display: 'flex', gap: 2,
            background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-4)', padding: 3, flexShrink: 0,
          }}>
            {RATING_FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setRatingFilter(f.value)}
                style={{
                  padding: '3px 9px', borderRadius: 'var(--r-3)', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.1s',
                  background: ratingFilter === f.value ? 'var(--surface)' : 'transparent',
                  color: ratingFilter === f.value ? 'var(--t1)' : 'var(--t3)',
                  boxShadow: ratingFilter === f.value ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          {sentimentEnabled && (
            <select
              aria-label="Filter reviews by sentiment"
              className="field"
              value={sentimentFilter}
              onChange={event => setSentimentFilter(event.target.value as SentimentFilter)}
              style={{ width: 126, padding: '6px 9px', fontSize: 11 }}
            >
              <option value="all">All sentiment</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginTop: 10, marginBottom: 0 }}>
        <svg
          style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--t4)' }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by author or content…"
          className="field"
          style={{ paddingLeft: 32, fontSize: 13 }}
        />
      </div>

      {/* Review list */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-6)', overflow: 'hidden', marginTop: 10, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p className="t-serif t-italic c-t3" style={{ fontSize: 18, marginBottom: 6 }}>Nothing here.</p>
            <p className="t-xs c-t3">
              {tab === 'completed' ? 'Mark a review as replied to move it here.' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          filtered.map(review => (
            <ReviewRow
              key={review.id}
              review={review}
              effectiveStatus={getStatus(review)}
              onSetStatus={(status) => setReviewStatus(review.id, status)}
              sentimentEnabled={sentimentEnabled}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          {currentPage > 1 && (
            <a href={`/dashboard?page=${currentPage - 1}`} className="btn btn-ghost btn-sm">← Prev</a>
          )}
          <span className="t-xs c-t3">Page {currentPage} of {totalPages}</span>
          {currentPage < totalPages && (
            <a href={`/dashboard?page=${currentPage + 1}`} className="btn btn-ghost btn-sm">Next →</a>
          )}
        </div>
      )}
    </div>
  )
}
