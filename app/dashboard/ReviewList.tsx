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

function formatReviewDate(timestamp: number | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tight">
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
}: {
  review: Review
  restaurantName: string
  effectiveStatus: string | null
  onToggle: () => void
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reply_draft_1' | 'reply_draft_2' | 'reply_draft_3'>('reply_draft_1')
  const [toggling, setToggling] = useState(false)

  const preview = review.review_text
    ? review.review_text.length > 90
      ? review.review_text.slice(0, 90) + '…'
      : review.review_text
    : null

  const activeText = review[activeTab]
  const reviewDate = formatReviewDate(review.review_timestamp)
  const isReplied = effectiveStatus === 'replied'
  const isLowRating = review.rating != null && review.rating <= 2

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
    <div className={`border rounded-lg transition-colors ${
      open ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
    } ${isReplied ? 'opacity-55' : ''}`}>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left px-4 py-3 flex items-center gap-3 min-w-0"
        >
          {/* Rating */}
          <div className="shrink-0 w-16 flex flex-col gap-0.5">
            {review.rating != null ? (
              <>
                <Stars rating={review.rating} />
                <span className="text-zinc-600 text-xs">{review.rating}/5</span>
              </>
            ) : (
              <span className="text-zinc-600 text-xs">—</span>
            )}
          </div>

          {/* Author + preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`text-sm font-medium truncate ${isReplied ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                {review.author ?? 'Anonymous'}
              </span>
              {isLowRating && !isReplied && (
                <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-900">
                  Needs attention
                </span>
              )}
            </div>
            {preview && (
              <p className="text-xs text-zinc-500 truncate">{preview}</p>
            )}
          </div>

          {/* Date + chevron */}
          <div className="shrink-0 flex flex-col items-end gap-0.5 text-zinc-600">
            <span className="text-xs">{reviewDate}</span>
            <svg
              className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Mark as replied toggle */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={isReplied ? 'Mark as needs reply' : 'Mark as replied'}
          className={`shrink-0 mr-3 w-7 h-7 flex items-center justify-center rounded-full border transition-colors ${
            isReplied
              ? 'border-emerald-700 bg-emerald-950 text-emerald-400 hover:bg-emerald-900'
              : 'border-zinc-700 bg-transparent text-zinc-600 hover:border-zinc-500 hover:text-zinc-400'
          } disabled:opacity-40`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
          {/* Metadata row */}
          <div className="flex flex-wrap gap-4 mb-4 text-xs text-zinc-500">
            <span>
              <span className="text-zinc-600">Posted</span>{' '}
              <span className="text-zinc-400">{reviewDate}</span>
            </span>
            {review.rating != null && (
              <span>
                <span className="text-zinc-600">Rating</span>{' '}
                <span className="text-amber-400">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>{' '}
                <span className="text-zinc-400">{review.rating} / 5</span>
              </span>
            )}
            {isReplied && (
              <span className="text-emerald-500">
                ✓ Already replied on Google
              </span>
            )}
            {isLowRating && !isReplied && (
              <span className="text-red-400">
                ⚠ Low rating — prioritize this response
              </span>
            )}
          </div>

          {/* Full review text */}
          {review.review_text ? (
            <p className="text-sm text-zinc-400 leading-relaxed mb-4 italic">
              &ldquo;{review.review_text}&rdquo;
            </p>
          ) : (
            <p className="text-sm text-zinc-600 mb-4 italic">No review text — rating only.</p>
          )}

          {/* Tab switcher + reply */}
          {(review.reply_draft_1 || review.reply_draft_2 || review.reply_draft_3) ? (
            <>
              <div className="flex gap-1 mb-3">
                {REPLY_LABELS.map(({ label, field }) => (
                  <button
                    key={field}
                    onClick={() => setActiveTab(field)}
                    className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                      activeTab === field
                        ? 'bg-zinc-700 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeText && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                  <p className="text-sm text-zinc-300 leading-relaxed mb-3">{activeText}</p>
                  <div className="flex items-center gap-2 justify-between">
                    <button
                      onClick={handleToggle}
                      disabled={toggling}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors border ${
                        isReplied
                          ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                          : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950'
                      } disabled:opacity-40`}
                    >
                      {isReplied ? 'Undo completed' : 'Mark as replied'}
                    </button>
                    <div className="flex items-center gap-2">
                      <CopyButton text={activeText} />
                      <PostReplyButton replyText={activeText} restaurantName={restaurantName} />
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-600 italic">
                {isReplied ? 'This review was already replied to on Google.' : 'Draft not yet generated.'}
              </p>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors border ${
                  isReplied
                    ? 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                    : 'border-emerald-800 text-emerald-400 hover:bg-emerald-950'
                } disabled:opacity-40`}
              >
                {isReplied ? 'Undo completed' : 'Mark as replied'}
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
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★' },
  { value: '3', label: '★★★' },
  { value: '1-2', label: '★–★★' },
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

  // Stats (always computed from full list)
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
    return reviews.filter(r => {
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5">
          <p className="text-xs text-zinc-600 mb-0.5">Total reviews</p>
          <p className="text-lg font-semibold text-zinc-100">{totalReviews}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5">
          <p className="text-xs text-zinc-600 mb-0.5">Avg rating</p>
          <p className="text-lg font-semibold text-amber-400">{avgRating ? `★ ${avgRating}` : '—'}</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-3 py-2.5">
          <p className="text-xs text-zinc-600 mb-0.5">Response rate</p>
          <p className="text-lg font-semibold text-zinc-100">{responseRate}%</p>
        </div>
        <div className={`border rounded-lg px-3 py-2.5 ${
          lowRatingPending > 0
            ? 'bg-red-950/30 border-red-900/60'
            : 'bg-zinc-900/50 border-zinc-800'
        }`}>
          <p className="text-xs text-zinc-600 mb-0.5">Low ratings pending</p>
          <p className={`text-lg font-semibold ${lowRatingPending > 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            {lowRatingPending}
          </p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-zinc-800 mb-4">
        {tabs.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? 'border-zinc-100 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              tab === t.value ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + rating filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by author or review text…"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 shrink-0">
          <span className="text-xs text-zinc-600 mr-1">Stars</span>
          {RATING_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRatingFilter(f.value)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                ratingFilter === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-zinc-800 rounded-lg px-4 py-10 text-center">
          <p className="text-zinc-500 text-sm">
            {tab === 'completed'
              ? 'No completed reviews yet. Mark a review as replied to move it here.'
              : 'No reviews match your filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(review => (
            <ReviewRow
              key={review.id}
              review={review}
              restaurantName={restaurantName}
              effectiveStatus={getStatus(review)}
              onToggle={() => toggleStatus(review)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
