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
  created_at: string
}

const REPLY_LABELS = [
  { label: 'Professional', field: 'reply_draft_1' },
  { label: 'Warm', field: 'reply_draft_2' },
  { label: 'Brief', field: 'reply_draft_3' },
] as const

type SectionTab = 'needs-reply' | 'completed' | 'all'
type RatingFilter = 'all' | '5' | '4' | '3' | '1-2'

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
    ? review.review_text.length > 80
      ? review.review_text.slice(0, 80) + '…'
      : review.review_text
    : null

  const activeText = review[activeTab]
  const date = new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const isReplied = effectiveStatus === 'replied'

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
    } ${isReplied ? 'opacity-60' : ''}`}>
      {/* Row — always visible */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left px-4 py-3 flex items-center gap-3 min-w-0"
        >
          {/* Rating */}
          <div className="shrink-0 w-16">
            {review.rating != null ? <Stars rating={review.rating} /> : <span className="text-zinc-600 text-xs">—</span>}
          </div>

          {/* Author + preview */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-sm font-medium truncate ${isReplied ? 'text-zinc-400 line-through' : 'text-zinc-100'}`}>
                {review.author ?? 'Anonymous'}
              </span>
            </div>
            {preview && (
              <p className="text-xs text-zinc-500 truncate">{preview}</p>
            )}
          </div>

          {/* Date + chevron */}
          <div className="shrink-0 flex items-center gap-2 text-zinc-600">
            <span className="text-xs">{date}</span>
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
          {/* Full review text */}
          {review.review_text && (
            <p className="text-sm text-zinc-400 leading-relaxed mb-4 italic">
              &ldquo;{review.review_text}&rdquo;
            </p>
          )}

          {/* Tab switcher */}
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

          {/* Active reply */}
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
    // Background refresh to sync server state
    router.refresh()
  }

  const needsReplyCount = reviews.filter(r => getStatus(r) !== 'replied').length
  const completedCount = reviews.filter(r => getStatus(r) === 'replied').length

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
    { value: 'all', label: 'All', count: reviews.length },
  ]

  return (
    <div>
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
            placeholder="Search reviews…"
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
            {tab === 'completed' ? 'No completed reviews yet.' : 'No reviews match your filters.'}
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
