'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import CopyButton from './CopyButton'
import PostReplyButton from './PostReplyButton'

type Review = {
  id: string
  restaurant_id: string
  author: string | null
  rating: number | null
  review_text: string | null
  reply_draft_1: string | null
  reply_draft_2: string | null
  reply_draft_3: string | null
  status: string | null
  review_timestamp: number | null
  replied_at: string | null
  created_at: string
}

type ReviewStats = {
  total: number
  needsReply: number
  urgent: number
  avgRating: number | null
}

const REPLY_LABELS = [
  { label: 'Professional', field: 'reply_draft_1' },
  { label: 'Warm', field: 'reply_draft_2' },
  { label: 'Brief', field: 'reply_draft_3' },
] as const

type SectionTab = 'needs-reply' | 'completed' | 'all'
type RatingFilter = 'all' | '5' | '4' | '3' | '1-2'

const OVERDUE_DAYS = 3

function formatReviewDate(timestamp: number | null): string {
  if (!timestamp) return '—'
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
    <span style={{ fontSize: 11, letterSpacing: 1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < rating ? '#f59e0b' : 'var(--border-hi)' }}>★</span>
      ))}
    </span>
  )
}

function ReviewRow({
  review,
  restaurantName,
  effectiveStatus,
  onToggle,
  index,
}: {
  review: Review
  restaurantName: string
  effectiveStatus: string | null
  onToggle: () => void
  index: number
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
    onToggle()
    await fetch('/api/reviews/mark-replied', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId: review.id, completed: !isReplied }),
    })
    setToggling(false)
  }

  return (
    <div
      className={`review-row fade-up ${open ? 'open' : ''} ${isReplied ? 'replied' : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', minWidth: 0 }}
        >
          {/* Rating */}
          <div style={{ flexShrink: 0, width: 58 }}>
            {review.rating != null ? (
              <>
                <Stars rating={review.rating} />
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{review.rating}/5</div>
              </>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--t3)' }}>—</span>
            )}
          </div>

          {/* Author + preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: isReplied ? 'var(--t3)' : 'var(--t1)',
                textDecoration: isReplied ? 'line-through' : 'none',
              }}>
                {review.author ?? 'Anonymous'}
              </span>
              {isLowRating && !isReplied && <span className="badge badge-red">Urgent</span>}
              {!isLowRating && isOverdueReview && <span className="badge badge-amber">Overdue</span>}
              {isReplied && <span className="badge badge-green">Replied</span>}
            </div>
            {review.review_text && (
              <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {review.review_text.slice(0, 96)}{review.review_text.length > 96 ? '…' : ''}
              </p>
            )}
          </div>

          {/* Date + chevron */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{reviewDate}</span>
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
        <div className="fade-in" style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
          {/* Metadata */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '16px 0', fontSize: 12 }}>
            {isLowRating && !isReplied && <span style={{ color: 'var(--err)', fontWeight: 500 }}>⚠ Prioritise this response</span>}
            {!isLowRating && isOverdueReview && <span style={{ color: 'var(--warn)', fontWeight: 500 }}>⏰ Waiting {OVERDUE_DAYS}+ days for a reply</span>}
            {isReplied && <span style={{ color: 'var(--ok)', fontWeight: 500 }}>✓ Already replied on Google</span>}
          </div>

          {/* Full review text */}
          {review.review_text ? (
            <div style={{ margin: '0 0 16px', paddingLeft: 14, borderLeft: '2px solid var(--border-md)' }}>
              <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
                &ldquo;{review.review_text}&rdquo;
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--t3)', fontStyle: 'italic', marginBottom: 16 }}>No review text — rating only.</p>
          )}

          {/* Reply drafts */}
          {(review.reply_draft_1 || review.reply_draft_2 || review.reply_draft_3) ? (
            <>
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

              {activeText && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border-md)', borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.75, margin: '0 0 14px' }}>{activeText}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <button
                      onClick={handleToggle}
                      disabled={toggling}
                      style={{
                        padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                        background: 'none', border: '1px solid var(--border-md)', color: 'var(--t2)',
                        fontFamily: 'inherit', transition: 'all 0.12s', opacity: toggling ? 0.4 : 1,
                      }}
                    >
                      {isReplied ? 'Undo replied' : 'Mark as replied'}
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <CopyButton text={activeText} />
                      <PostReplyButton
                        replyText={activeText}
                        reviewId={review.id}
                        onReplied={() => { if (!isReplied) onToggle() }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>
                {isReplied ? 'This review was already replied to on Google.' : 'Draft not yet generated.'}
              </p>
              <button
                onClick={handleToggle}
                disabled={toggling}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 8, cursor: 'pointer',
                  background: 'none', border: '1px solid var(--border-md)', color: 'var(--t2)',
                  fontFamily: 'inherit', opacity: toggling ? 0.4 : 1,
                }}
              >
                {isReplied ? 'Undo replied' : 'Mark as replied'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
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
  restaurantName,
  stats,
  currentPage,
  totalPages,
}: {
  reviews: Review[]
  restaurantName: string
  stats: ReviewStats
  currentPage: number
  totalPages: number
}) {
  const router = useRouter()
  const [tab, setTab] = useState<SectionTab>('needs-reply')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [search, setSearch] = useState('')
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({})

  function getStatus(review: Review): string | null {
    return localStatus[review.id] ?? review.status
  }

  function toggleStatus(review: Review) {
    const current = getStatus(review)
    const next = current === 'replied' ? 'drafted' : 'replied'
    setLocalStatus(prev => ({ ...prev, [review.id]: next }))
    // No router.refresh() here — optimistic update is sufficient for the toggle.
    // A refresh only happens after a real sync (handled in Settings page).
  }

  const responseRate = stats.total > 0
    ? Math.round(((stats.total - stats.needsReply) / stats.total) * 100)
    : 0

  const filtered = useMemo(() => {
    const base = reviews.filter(r => {
      const status = localStatus[r.id] ?? r.status
      if (tab === 'needs-reply' && status === 'replied') return false
      if (tab === 'completed' && status !== 'replied') return false
      if (ratingFilter === '5' && r.rating !== 5) return false
      if (ratingFilter === '4' && r.rating !== 4) return false
      if (ratingFilter === '3' && r.rating !== 3) return false
      if (ratingFilter === '1-2' && (r.rating == null || r.rating > 2)) return false
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
        return isOverdue(a.created_at) ? -1 : isOverdue(b.created_at) ? 1 : 0
      })
    }
    return base
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, tab, ratingFilter, search, localStatus])

  const localNeedsReply = reviews.filter(r => getStatus(r) !== 'replied').length
  const localCompleted = reviews.filter(r => getStatus(r) === 'replied').length

  const tabs: { value: SectionTab; label: string; count: number }[] = [
    { value: 'needs-reply', label: 'Needs Reply', count: localNeedsReply },
    { value: 'completed',   label: 'Completed',   count: localCompleted },
    { value: 'all',         label: 'All',          count: reviews.length },
  ]

  return (
    <div>
      {/* Stats — sourced from server-computed values */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Needs reply',   value: stats.needsReply,                          color: 'var(--t1)',  danger: false },
          { label: 'Avg rating',    value: stats.avgRating ? `★ ${stats.avgRating.toFixed(1)}` : '—', color: '#f59e0b', danger: false },
          { label: 'Response rate', value: `${responseRate}%`,                         color: 'var(--t1)',  danger: false },
          { label: 'Urgent',        value: stats.urgent,                               color: stats.urgent > 0 ? 'var(--err)' : 'var(--t3)', danger: stats.urgent > 0 },
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

      {/* Tab bar */}
      <div className="tab-bar" style={{ marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.value} onClick={() => setTab(t.value)} className={`tab-btn ${tab === t.value ? 'active' : ''}`}>
            {t.label}
            <span className="badge badge-zinc" style={{ padding: '1px 6px', fontSize: 10 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Search + rating filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--t3)' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by author or content…"
            style={{
              width: '100%', background: 'var(--surface-1)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-m)', padding: '8px 14px 8px 34px', fontSize: 13,
              color: 'var(--t1)', outline: 'none', fontFamily: 'inherit',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-sub)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, flexShrink: 0,
        }}>
          {RATING_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRatingFilter(f.value)}
              style={{
                padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.12s',
                background: ratingFilter === f.value ? 'var(--surface-2)' : 'transparent',
                color: ratingFilter === f.value ? 'var(--t1)' : 'var(--t3)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Review list */}
      {filtered.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 16, padding: '56px 24px', textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, background: 'var(--surface-1)', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>
            {tab === 'completed' ? 'No completed reviews yet' : 'No reviews match your filters'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {tab === 'completed' ? 'Mark a review as replied to move it here.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((review, i) => (
            <ReviewRow
              key={review.id}
              review={review}
              restaurantName={restaurantName}
              effectiveStatus={getStatus(review)}
              onToggle={() => toggleStatus(review)}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          {currentPage > 1 && (
            <a
              href={`/dashboard?page=${currentPage - 1}`}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                border: '1px solid var(--border-md)', color: 'var(--t2)', textDecoration: 'none',
              }}
            >
              ← Prev
            </a>
          )}
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={`/dashboard?page=${currentPage + 1}`}
              style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
                border: '1px solid var(--border-md)', color: 'var(--t2)', textDecoration: 'none',
              }}
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  )
}
