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
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function isOverdue(createdAt: string): boolean {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  return now - created > OVERDUE_DAYS * 24 * 60 * 60 * 1000
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  return (
    <span className={`text-amber-400 tracking-tight ${size === 'xs' ? 'text-xs' : 'text-xs'}`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
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

  const preview = review.review_text
    ? review.review_text.length > 80
      ? review.review_text.slice(0, 80) + '…'
      : review.review_text
    : null

  const activeText = review[activeTab]
  const reviewDate = formatReviewDate(review.review_timestamp)
  const isReplied = effectiveStatus === 'replied'
  const isLowRating = review.rating != null && review.rating <= 2
  const isOverdueReview = !isReplied && isOverdue(review.created_at)

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
      className={`rounded-xl border transition-all fade-up ${
        open
          ? 'border-zinc-700 bg-zinc-900/80'
          : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700/80 hover:bg-zinc-900/50'
      } ${isReplied ? 'opacity-50' : ''}`}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Row header */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left px-4 py-3.5 flex items-center gap-3 min-w-0"
        >
          {/* Rating column */}
          <div className="shrink-0 w-14">
            {review.rating != null ? (
              <div className="flex flex-col gap-0.5">
                <Stars rating={review.rating} />
                <span className="text-zinc-700 text-xs">{review.rating}/5</span>
              </div>
            ) : (
              <span className="text-zinc-700 text-xs">—</span>
            )}
          </div>

          {/* Author + preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-sm font-medium truncate ${
                isReplied ? 'text-zinc-600 line-through decoration-zinc-700' : 'text-zinc-100'
              }`}>
                {review.author ?? 'Anonymous'}
              </span>
              {isLowRating && !isReplied && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-red-950 text-red-400 border border-red-900/60 font-medium">
                  Urgent
                </span>
              )}
              {!isLowRating && isOverdueReview && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-900/40 font-medium">
                  Overdue
                </span>
              )}
              {isReplied && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-md bg-emerald-950/60 text-emerald-500 border border-emerald-900/40">
                  Replied
                </span>
              )}
            </div>
            {preview && (
              <p className="text-xs text-zinc-600 truncate leading-relaxed">{preview}</p>
            )}
          </div>

          {/* Date + chevron */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs text-zinc-700">{reviewDate}</span>
            <svg
              className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Mark-replied toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={isReplied ? 'Mark as needs reply' : 'Mark as replied'}
          className={`shrink-0 mr-3 w-7 h-7 flex items-center justify-center rounded-full border transition-all btn-press ${
            isReplied
              ? 'border-emerald-700/80 bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60'
              : 'border-zinc-700/80 bg-transparent text-zinc-700 hover:border-zinc-500 hover:text-zinc-400'
          } disabled:opacity-40`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-800/60 pt-4">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs">
            <span className="text-zinc-600">
              Posted <span className="text-zinc-400">{reviewDate}</span>
            </span>
            {review.rating != null && (
              <span className="text-zinc-600">
                Rating{' '}
                <span className="text-amber-400">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>{' '}
                <span className="text-zinc-500">{review.rating}/5</span>
              </span>
            )}
            {isReplied && (
              <span className="text-emerald-500 font-medium">Already replied on Google</span>
            )}
            {isLowRating && !isReplied && (
              <span className="text-red-400 font-medium">Urgent — prioritize this response</span>
            )}
            {!isLowRating && isOverdueReview && (
              <span className="text-amber-400 font-medium">Overdue — waiting {OVERDUE_DAYS}+ days for a reply</span>
            )}
          </div>

          {/* Full review text */}
          {review.review_text ? (
            <p className="text-sm text-zinc-400 leading-relaxed mb-4 italic border-l-2 border-zinc-800 pl-3">
              &ldquo;{review.review_text}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-zinc-700 mb-4 italic">No review text — rating only.</p>
          )}

          {/* Reply drafts */}
          {(review.reply_draft_1 || review.reply_draft_2 || review.reply_draft_3) ? (
            <>
              <div className="flex gap-1 mb-3 p-1 bg-zinc-950/60 rounded-xl w-fit border border-zinc-800/60">
                {REPLY_LABELS.map(({ label, field }) => (
                  <button
                    key={field}
                    onClick={() => setActiveTab(field)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeTab === field
                        ? 'bg-zinc-700 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeText && (
                <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4">
                  <p className="text-sm text-zinc-300 leading-relaxed mb-4">{activeText}</p>
                  <div className="flex items-center gap-2 justify-between flex-wrap">
                    <button
                      onClick={handleToggle}
                      disabled={toggling}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border btn-press ${
                        isReplied
                          ? 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                          : 'border-emerald-800/60 text-emerald-500 hover:bg-emerald-950/40'
                      } disabled:opacity-40`}
                    >
                      {isReplied ? 'Undo replied' : 'Mark as replied'}
                    </button>
                    <div className="flex items-center gap-2">
                      <CopyButton text={activeText} />
                      <PostReplyButton replyText={activeText} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-700 italic">
                {isReplied ? 'This review was already replied to on Google.' : 'Draft not yet generated.'}
              </p>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border btn-press ${
                  isReplied
                    ? 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    : 'border-emerald-800/60 text-emerald-500 hover:bg-emerald-950/40'
                } disabled:opacity-40`}
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

export default function ReviewList({ reviews, restaurantName }: { reviews: Review[]; restaurantName: string }) {
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
    router.refresh()
  }

  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / totalReviews).toFixed(1)
    : null
  const needsReplyCount = reviews.filter(r => getStatus(r) !== 'replied').length
  const completedCount = reviews.filter(r => getStatus(r) === 'replied').length
  const responseRate = totalReviews > 0
    ? Math.round((completedCount / totalReviews) * 100)
    : 0
  const lowRatingPending = reviews.filter(
    r => getStatus(r) !== 'replied' && r.rating != null && r.rating <= 2
  ).length

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

    // Sort: urgent (low-rating, unreplied) first, then overdue, then rest
    if (tab === 'needs-reply') {
      base.sort((a, b) => {
        const aUrgent = (localStatus[a.id] ?? a.status) !== 'replied' && a.rating != null && a.rating <= 2 ? 0 : 1
        const bUrgent = (localStatus[b.id] ?? b.status) !== 'replied' && b.rating != null && b.rating <= 2 ? 0 : 1
        if (aUrgent !== bUrgent) return aUrgent - bUrgent

        const aOverdue = isOverdue(a.created_at) ? 0 : 1
        const bOverdue = isOverdue(b.created_at) ? 0 : 1
        return aOverdue - bOverdue
      })
    }

    return base
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, tab, ratingFilter, search, localStatus])

  const tabs: { value: SectionTab; label: string; count: number }[] = [
    { value: 'needs-reply', label: 'Needs Reply', count: needsReplyCount },
    { value: 'completed', label: 'Completed', count: completedCount },
    { value: 'all', label: 'All', count: totalReviews },
  ]

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 fade-up">
          <p className="text-xs text-zinc-600 mb-1">Needs reply</p>
          <p className="text-xl font-semibold text-zinc-100">{needsReplyCount}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 fade-up" style={{ animationDelay: '40ms' }}>
          <p className="text-xs text-zinc-600 mb-1">Avg rating</p>
          <p className="text-xl font-semibold text-amber-400">{avgRating ? `★ ${avgRating}` : '—'}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3 fade-up" style={{ animationDelay: '80ms' }}>
          <p className="text-xs text-zinc-600 mb-1">Response rate</p>
          <p className="text-xl font-semibold text-zinc-100">{responseRate}%</p>
        </div>
        <div className={`rounded-xl px-4 py-3 border fade-up ${
          lowRatingPending > 0
            ? 'bg-red-950/30 border-red-900/50'
            : 'bg-zinc-900/50 border-zinc-800/60'
        }`} style={{ animationDelay: '120ms' }}>
          <p className="text-xs text-zinc-600 mb-1">Urgent</p>
          <p className={`text-xl font-semibold ${lowRatingPending > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
            {lowRatingPending}
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-zinc-800/60 mb-4">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2 ${
              tab === t.value
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-600 hover:text-zinc-300'
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              tab === t.value
                ? 'bg-zinc-700 text-zinc-200'
                : 'bg-zinc-800/80 text-zinc-600'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + rating filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search author or review text…"
            className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-0.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl px-1.5 py-1.5 shrink-0">
          {RATING_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRatingFilter(f.value)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                ratingFilter === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-zinc-800/60 rounded-2xl px-4 py-12 text-center">
          <p className="text-zinc-600 text-sm">
            {tab === 'completed'
              ? 'No completed reviews yet. Mark a review as replied to move it here.'
              : 'No reviews match your filters.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
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
    </div>
  )
}
