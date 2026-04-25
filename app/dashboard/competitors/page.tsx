'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

type Restaurant = { id: string; name: string; competitorLimit: number; plan: string }

type SearchResult = {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalRatings: number | null
}

type Competitor = {
  id: string
  name: string
  googlePlaceId: string
  address: string
  latestSnapshot: { avg_rating: number | null; total_reviews: number | null; snapshot_date: string } | null
}

type ComparisonData = {
  yourRestaurant: { name: string; avgRating: number | null; totalReviews: number; rank: number }
  competitors: Array<{
    id: string
    name: string
    googlePlaceId: string
    avgRating: number | null
    totalReviews: number | null
    ratingDelta: number | null
    rank: number
  }>
  totalTracked: number
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span style={{ color: 'var(--t3)', fontSize: 13 }}>—</span>
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--amber, #f59e0b)" stroke="none">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{rating.toFixed(1)}</span>
    </span>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: '#f59e0b',
    2: '#9ca3af',
    3: '#cd7c3e',
  }
  const color = colors[rank] ?? 'var(--t3)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 24, height: 24, borderRadius: '50%',
      background: `${color}22`, border: `1.5px solid ${color}`,
      fontSize: 11, fontWeight: 800, color,
    }}>
      {rank}
    </span>
  )
}

export default function CompetitorsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoDiscovering, setAutoDiscovering] = useState(false)
  const [autoDiscoverMsg, setAutoDiscoverMsg] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = getSupabaseBrowser()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setAuthError(true); return }

      const res = await fetch('/api/restaurant')
      if (!res.ok) { setAuthError(true); return }
      const r: Restaurant = await res.json()
      setRestaurant(r)
      const loaded = await loadData(r.id)
      // Auto-discover on first visit when no competitors have been added yet
      if (loaded.competitorCount === 0) {
        await runAutoDiscover(r.id, true)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadData(restaurantId: string): Promise<{ competitorCount: number }> {
    const [compRes, cmpRes] = await Promise.all([
      fetch(`/api/competitors?restaurantId=${restaurantId}`),
      fetch(`/api/competitors/comparison?restaurantId=${restaurantId}`),
    ])
    let count = 0
    if (compRes.ok) {
      const list: Competitor[] = await compRes.json()
      setCompetitors(list)
      count = list.length
    }
    if (cmpRes.ok) setComparison(await cmpRes.json())
    return { competitorCount: count }
  }

  async function runAutoDiscover(restaurantId: string, silent = false) {
    if (autoDiscovering) return
    setAutoDiscovering(true)
    if (!silent) setAutoDiscoverMsg(null)
    try {
      const res = await fetch('/api/competitors/auto-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      const data = await res.json()
      if (res.ok) {
        await loadData(restaurantId)
        if (data.added > 0) {
          setAutoDiscoverMsg(`Found and added ${data.added} nearby competitor${data.added !== 1 ? 's' : ''} automatically.`)
        } else if (!silent) {
          setAutoDiscoverMsg('No new nearby competitors found.')
        }
      } else {
        if (!silent) setAutoDiscoverMsg(data.error ?? 'Auto-discover failed.')
      }
    } catch {
      if (!silent) setAutoDiscoverMsg('Auto-discover failed — check your connection.')
    } finally {
      setAutoDiscovering(false)
    }
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); setShowDropdown(false); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/competitors/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const results = await res.json()
        setSearchResults(results)
        setShowDropdown(results.length > 0)
      }
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setSearchQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q), 500)
  }

  async function handleAdd(placeId: string) {
    if (!restaurant) return
    setAddingId(placeId)
    setError(null)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: restaurant.id, placeId }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to add competitor')
      } else {
        setSearchQuery('')
        setSearchResults([])
        setShowDropdown(false)
        await loadData(restaurant.id)
      }
    } finally {
      setAddingId(null)
    }
  }

  async function handleRemove(competitorId: string) {
    if (!restaurant) return
    setRemovingId(competitorId)
    try {
      const res = await fetch(`/api/competitors?competitorId=${competitorId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to remove competitor')
      } else {
        await loadData(restaurant.id)
      }
    } catch {
      setError('Failed to remove competitor')
    } finally {
      setRemovingId(null)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const competitorLimit = restaurant?.competitorLimit ?? 3
  const atLimit = competitors.length >= competitorLimit

  if (authError) {
    return (
      <div className="page-wrap" style={{ textAlign: 'center', paddingTop: 64 }}>
        <p style={{ color: 'var(--t3)', fontSize: 14 }}>Please sign in to view this page.</p>
      </div>
    )
  }

  const yourEntry = comparison?.yourRestaurant
  const allEntries: Array<{ id: string | 'you'; name: string; avgRating: number | null; totalReviews: number | null; ratingDelta: number | null; rank: number; isYou: boolean }> = comparison
    ? [
        { id: 'you', name: yourEntry!.name, avgRating: yourEntry!.avgRating, totalReviews: yourEntry!.totalReviews, ratingDelta: null, rank: yourEntry!.rank, isYou: true },
        ...comparison.competitors.map(c => ({ ...c, id: c.id, isYou: false })),
      ].sort((a, b) => a.rank - b.rank)
    : []

  return (
    <>
      <div className="sec-head">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>
            Competitor Tracking
          </h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>See how your ratings stack up against nearby restaurants</p>
        </div>
      </div>

      <div className="page-wrap">

        {/* Your position card */}
        {comparison && (
          <div className="card fade-up" style={{ padding: '20px 24px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'var(--surface-2)', border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <RankBadge rank={comparison.yourRestaurant.rank} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>
                You are ranked <span style={{ color: 'var(--accent)' }}>#{comparison.yourRestaurant.rank}</span> of {comparison.totalTracked} restaurants you&apos;re tracking
              </p>
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>
                {comparison.yourRestaurant.avgRating !== null
                  ? `${comparison.yourRestaurant.avgRating.toFixed(1)} ★ · ${comparison.yourRestaurant.totalReviews.toLocaleString()} reviews`
                  : 'No rating data yet — sync reviews to populate your score'}
              </p>
            </div>
          </div>
        )}

        {/* Add competitor */}
        <div className="card fade-up" style={{ padding: 24, marginBottom: 12, position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Add Competitor</h2>
            {!atLimit && (
              <button
                onClick={() => restaurant && runAutoDiscover(restaurant.id)}
                disabled={autoDiscovering}
                className="btn-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: 'var(--accent-sub)', color: 'var(--accent-hi)',
                  border: '1px solid oklch(0.62 0.19 258 / 0.25)',
                  cursor: autoDiscovering ? 'not-allowed' : 'pointer',
                  opacity: autoDiscovering ? 0.6 : 1, fontFamily: 'inherit',
                }}
              >
                {autoDiscovering ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    Finding…
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    Auto-discover nearby
                  </>
                )}
              </button>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: autoDiscoverMsg ? 10 : 14 }}>
            <span style={{ fontWeight: 600, color: atLimit ? 'var(--err)' : 'var(--t2)' }}>
              {competitors.length} / {competitorLimit}
            </span>{' '}competitor slot{competitorLimit !== 1 ? 's' : ''} used.{' '}
            {atLimit && (
              <><span style={{ color: 'var(--err)', fontWeight: 600 }}>Limit reached.</span>{' '}
              <a href="/dashboard/billing" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>Upgrade to add more</a></>
            )}
          </p>
          {autoDiscoverMsg && (
            <div className="banner banner-green fade-up" style={{ marginBottom: 14 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              {autoDiscoverMsg}
            </div>
          )}

          <div ref={dropdownRef} style={{ position: 'relative', maxWidth: 440 }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search for a competitor restaurant..."
                value={searchQuery}
                onChange={handleSearchChange}
                disabled={atLimit}
                style={{
                  width: '100%', padding: '10px 38px 10px 14px', borderRadius: 10,
                  border: '1px solid var(--border-md)', background: 'var(--surface-2)',
                  color: 'var(--t1)', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                  opacity: atLimit ? 0.5 : 1,
                }}
              />
              {searchLoading && (
                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                </div>
              )}
            </div>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: 'var(--surface-0)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 50,
                overflow: 'hidden',
              }}>
                {searchResults.map((r) => {
                  const alreadyAdded = competitors.some(c => c.googlePlaceId === r.placeId)
                  const isAdding = addingId === r.placeId
                  return (
                    <button
                      key={r.placeId}
                      onClick={() => !alreadyAdded && handleAdd(r.placeId)}
                      disabled={alreadyAdded || isAdding || atLimit}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 14px',
                        background: 'transparent', border: 'none',
                        borderBottom: '1px solid var(--border)', cursor: alreadyAdded ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        opacity: alreadyAdded ? 0.5 : 1,
                        transition: 'background 80ms',
                      }}
                      onMouseEnter={e => { if (!alreadyAdded) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.name}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.address}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {r.rating !== null && (
                          <span style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--amber, #f59e0b)" stroke="none">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                            {r.rating.toFixed(1)}
                          </span>
                        )}
                        {alreadyAdded ? (
                          <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 500 }}>Added</span>
                        ) : isAdding ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                            background: 'var(--accent-sub)', borderRadius: 6, padding: '3px 8px',
                          }}>Add</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--red, #ef4444)' }}>{error}</p>
          )}
        </div>

        {/* Comparison table */}
        {allEntries.length > 0 && (
          <div className="card fade-up" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>Comparison</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Rank', 'Restaurant', 'Rating', 'Reviews', 'vs. You'].map(col => (
                      <th key={col} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                        {col}
                      </th>
                    ))}
                    <th style={{ padding: '10px 16px', width: 32 }} />
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry, i) => {
                    const isYou = entry.isYou
                    const delta = entry.ratingDelta
                    const isBetter = delta !== null && delta > 0
                    const isWorse = delta !== null && delta < 0
                    return (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom: i < allEntries.length - 1 ? '1px solid var(--border)' : undefined,
                          background: isYou ? 'var(--accent-sub)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <RankBadge rank={entry.rank} />
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontWeight: isYou ? 700 : 500, color: 'var(--t1)' }}>
                            {entry.name}
                          </span>
                          {isYou && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-sub)', border: '1px solid var(--accent)', borderRadius: 5, padding: '1px 6px' }}>
                              You
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <StarRating rating={entry.avgRating} />
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>
                          {entry.totalReviews !== null ? entry.totalReviews.toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {isYou ? (
                            <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>
                          ) : delta === null ? (
                            <span style={{ color: 'var(--t3)', fontSize: 12 }}>—</span>
                          ) : (
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              color: isBetter ? 'var(--red, #ef4444)' : isWorse ? 'var(--green, #22c55e)' : 'var(--t3)',
                            }}>
                              {isBetter ? '+' : ''}{delta.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {!isYou && (
                            <button
                              onClick={() => handleRemove(entry.id as string)}
                              disabled={removingId === entry.id}
                              title="Remove competitor"
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--t3)', padding: 4, borderRadius: 6,
                                opacity: removingId === entry.id ? 0.4 : 1,
                                display: 'flex', alignItems: 'center',
                                transition: 'color 80ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red, #ef4444)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--t3)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state — shown when no competitors added yet */}
        {competitors.length === 0 && comparison !== null && (
          <div className="card fade-up" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>No competitors tracked yet</p>
            <p style={{ fontSize: 13, color: 'var(--t3)' }}>Search for nearby restaurants above, or use auto-discover to find them automatically.</p>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
