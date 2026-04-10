'use client'

import { useState, useMemo } from 'react'
import CopyButton from './CopyButton'

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

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs tracking-tight">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const emailed = status === 'emailed'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
      emailed
        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
    }`}>
      {emailed ? 'Emailed' : 'Drafted'}
    </span>
  )
}

function ReviewRow({ review }: { review: Review }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'reply_draft_1' | 'reply_draft_2' | 'reply_draft_3'>('reply_draft_1')

  const preview = review.review_text
    ? review.review_text.length > 80
      ? review.review_text.slice(0, 80) + '…'
      : review.review_text
    : null

  const activeText = review[activeTab]
  const date = new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className={`border rounded-lg transition-colors ${
      open ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-800 bg-zinc-900/20 hover:border-zinc-700'
    }`}>
      {/* Row — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 flex items-center gap-3"
      >
        {/* Rating */}
        <div className="shrink-0 w-16">
          {review.rating != null ? <Stars rating={review.rating} /> : <span className="text-zinc-600 text-xs">—</span>}
        </div>

        {/* Author + preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-zinc-100 truncate">
              {review.author ?? 'Anonymous'}
            </span>
            <StatusBadge status={review.status} />
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
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-zinc-300 leading-relaxed flex-1">{activeText}</p>
                <div className="shrink-0 mt-0.5">
                  <CopyButton text={activeText} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type FilterValue = 'all' | 'drafted' | 'emailed' | '5' | '4' | '3' | '1-2'

export default function ReviewList({ reviews }: { reviews: Review[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')

  const filtered = useMemo(() => {
    return reviews.filter(r => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const matchesAuthor = (r.author ?? '').toLowerCase().includes(q)
        const matchesText = (r.review_text ?? '').toLowerCase().includes(q)
        if (!matchesAuthor && !matchesText) return false
      }

      // Filter
      if (filter === 'drafted') return r.status !== 'emailed'
      if (filter === 'emailed') return r.status === 'emailed'
      if (filter === '5') return r.rating === 5
      if (filter === '4') return r.rating === 4
      if (filter === '3') return r.rating === 3
      if (filter === '1-2') return r.rating != null && r.rating <= 2

      return true
    })
  }, [reviews, search, filter])

  const filters: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'drafted', label: 'Drafted' },
    { value: 'emailed', label: 'Emailed' },
    { value: '5', label: '★★★★★' },
    { value: '4', label: '★★★★' },
    { value: '3', label: '★★★' },
    { value: '1-2', label: '★–★★' },
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* Search */}
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

        {/* Filter pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                filter === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-zinc-600 mb-3">
        {filtered.length} {filtered.length === 1 ? 'review' : 'reviews'}
        {filter !== 'all' || search ? ' matching' : ' total'}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="border border-zinc-800 rounded-lg px-4 py-10 text-center">
          <p className="text-zinc-500 text-sm">No reviews match your search.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(review => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  )
}
