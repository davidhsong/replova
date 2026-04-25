'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { IconSearch, IconRefresh, IconTrash } from '@/components/icons'

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

const MEDAL_COLORS: Record<number, string> = { 1: '#c08725', 2: '#7c7569', 3: '#a06430' }

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
      const { data: { user } } = await getSupabaseBrowser().auth.getUser()
      if (!user) { setAuthError(true); return }
      const res = await fetch('/api/restaurant')
      if (!res.ok) { setAuthError(true); return }
      const r: Restaurant = await res.json()
      setRestaurant(r)
      const loaded = await loadData(r.id)
      if (loaded.competitorCount === 0) await runAutoDiscover(r.id, true)
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
      } else if (!silent) {
        setAutoDiscoverMsg(data.error ?? 'Auto-discover failed.')
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
      <div className="page-body" style={{ textAlign: 'center', paddingTop: 64 }}>
        <p className="t-sm c-t3">Please sign in to view this page.</p>
      </div>
    )
  }

  const yourEntry = comparison?.yourRestaurant
  const allEntries: Array<{
    id: string | 'you'
    name: string
    avgRating: number | null
    totalReviews: number | null
    ratingDelta: number | null
    rank: number
    isYou: boolean
  }> = comparison
    ? [
        { id: 'you', name: yourEntry!.name, avgRating: yourEntry!.avgRating, totalReviews: yourEntry!.totalReviews, ratingDelta: null, rank: yourEntry!.rank, isYou: true },
        ...comparison.competitors.map(c => ({ ...c, isYou: false })),
      ].sort((a, b) => a.rank - b.rank)
    : []

  const yourRank = comparison?.yourRestaurant.rank ?? null
  const totalTracked = comparison?.totalTracked ?? 0

  return (
    <>
      <div className="page-header">
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--t3)' }}>Workspace</span>
          {' › '}
          <span>Competitors</span>
        </div>
        <h1 className="t-h1" style={{ marginBottom: 4 }}>Competitors</h1>
        <p className="t-sm c-t3">
          {competitors.length} of {competitorLimit} competitor slots used
        </p>
      </div>

      <div className="page-body">

        {/* Rank statement card */}
        {comparison && yourRank !== null && (
          <div className="card fade-up" style={{ padding: 32, marginBottom: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
            {/* Left: dramatic rank number */}
            <div>
              <div className="t-eyebrow" style={{ marginBottom: 14 }}>Your position</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="t-serif" style={{ fontSize: 88, lineHeight: 1, letterSpacing: '-0.04em' }}>#{yourRank}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--t3)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                  of {totalTracked}
                </span>
              </div>
              {yourEntry?.avgRating !== null && (
                <p className="t-body c-t2" style={{ lineHeight: 1.6 }}>
                  Your current rating:{' '}
                  <strong style={{ color: 'var(--t1)' }}>{yourEntry?.avgRating?.toFixed(1)} ★</strong>
                  {' · '}{yourEntry?.totalReviews.toLocaleString()} reviews
                </p>
              )}
            </div>

            {/* Right: ranked list */}
            <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 32 }}>
              <div className="t-eyebrow" style={{ marginBottom: 16 }}>Set</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allEntries.map((entry, i) => (
                  <div key={String(entry.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 'var(--r-3)',
                    background: entry.isYou ? 'var(--accent-sub)' : 'transparent',
                  }}>
                    <span className="t-mono tnum" style={{
                      width: 20, fontSize: 11, fontWeight: 700,
                      color: MEDAL_COLORS[i + 1] ?? 'var(--t3)',
                      flexShrink: 0,
                    }}>
                      #{i + 1}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 13,
                      fontWeight: entry.isYou ? 700 : 500,
                      color: entry.isYou ? 'var(--accent)' : 'var(--t1)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {entry.name}
                      {entry.isYou && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, opacity: 0.7 }}>YOU</span>}
                    </span>
                    {entry.avgRating !== null && (
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--gold)', flexShrink: 0 }}>
                        {entry.avgRating.toFixed(1)}★
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Two-column: add panel + table */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'flex-start' }}>

          {/* Left: add competitor */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div className="t-eyebrow">Add competitor</div>
              <span className="t-mono t-xs c-t3 tnum">{competitors.length} / {competitorLimit} slots</span>
            </div>

            {autoDiscoverMsg && (
              <div className="banner banner-pos fade-in" style={{ marginBottom: 12 }}>
                {autoDiscoverMsg}
              </div>
            )}

            {error && (
              <div className="banner banner-neg fade-in" style={{ marginBottom: 12 }}>
                {error}
              </div>
            )}

            {/* Search */}
            <div ref={dropdownRef} style={{ position: 'relative', marginBottom: 10 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '50%', left: 11, transform: 'translateY(-50%)', color: 'var(--t4)', pointerEvents: 'none' }}>
                  <IconSearch s={13} />
                </span>
                <input
                  type="text"
                  placeholder="Search Google Places…"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  disabled={atLimit}
                  className="field"
                  style={{ paddingLeft: 32, fontSize: 13, opacity: atLimit ? 0.5 : 1 }}
                />
                {searchLoading && (
                  <span className="spin" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', display: 'inline-flex', color: 'var(--t3)' }}>
                    <IconRefresh s={13} />
                  </span>
                )}
              </div>

              {showDropdown && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: 'var(--surface)', border: '1px solid var(--line)',
                  borderRadius: 'var(--r-5)', boxShadow: 'var(--shadow-2)', zIndex: 50, overflow: 'hidden',
                }}>
                  {searchResults.map((r, i) => {
                    const alreadyAdded = competitors.some(c => c.googlePlaceId === r.placeId)
                    const isAdding = addingId === r.placeId
                    return (
                      <div key={r.placeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                          <div className="t-xs c-t3" style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.address}{r.rating !== null ? ` · ${r.rating.toFixed(1)}★` : ''}
                          </div>
                        </div>
                        {alreadyAdded ? (
                          <span className="t-xs c-t3">Added</span>
                        ) : (
                          <button
                            onClick={() => handleAdd(r.placeId)}
                            disabled={isAdding || atLimit}
                            className="btn btn-ghost btn-sm"
                          >
                            {isAdding ? '…' : 'Add'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => restaurant && runAutoDiscover(restaurant.id)}
              disabled={autoDiscovering || atLimit}
              className="btn btn-ghost btn-sm"
              style={{ width: '100%' }}
            >
              <span className={autoDiscovering ? 'spin' : undefined} style={{ display: 'inline-flex' }}>
                <IconRefresh s={11} />
              </span>
              {autoDiscovering ? 'Finding…' : 'Auto-discover nearby'}
            </button>

            <p className="t-xs c-t3" style={{ marginTop: 12, lineHeight: 1.5 }}>
              We'll surface similar restaurants within a mile. You decide which to track.
            </p>

            {atLimit && (
              <div className="banner banner-warn" style={{ marginTop: 12 }}>
                Limit reached.{' '}
                <a href="/dashboard/billing" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>Upgrade to add more →</a>
              </div>
            )}
          </div>

          {/* Right: comparison table or empty state */}
          {allEntries.length > 0 ? (
            <div className="card" style={{ overflow: 'hidden' }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Rank</th>
                    <th>Restaurant</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Rating</th>
                    <th style={{ width: 90, textAlign: 'right' }}>Reviews</th>
                    <th style={{ width: 110, textAlign: 'right' }}>vs. You</th>
                    <th style={{ width: 44 }} />
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry, i) => {
                    const delta = entry.ratingDelta
                    const isAhead = delta !== null && delta > 0
                    const isBehind = delta !== null && delta < 0
                    return (
                      <tr key={String(entry.id)} style={{ background: entry.isYou ? 'var(--accent-sub)' : undefined }}>
                        <td>
                          <span className="t-mono tnum" style={{ fontWeight: 700, fontSize: 12, color: MEDAL_COLORS[i + 1] ?? 'var(--t3)' }}>
                            #{i + 1}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: entry.isYou ? 700 : 500, color: entry.isYou ? 'var(--accent)' : 'var(--t1)' }}>
                              {entry.name}
                            </span>
                            {entry.isYou && <span className="pill pill-accent" style={{ height: 18 }}>You</span>}
                          </div>
                        </td>
                        <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {entry.avgRating !== null
                            ? <>{entry.avgRating.toFixed(1)} <span style={{ color: 'var(--gold)' }}>★</span></>
                            : <span className="c-t3">—</span>
                          }
                        </td>
                        <td className="tnum c-t2" style={{ textAlign: 'right' }}>
                          {entry.totalReviews !== null ? entry.totalReviews.toLocaleString() : '—'}
                        </td>
                        <td className="tnum" style={{ textAlign: 'right' }}>
                          {entry.isYou || delta === null ? (
                            <span className="c-t3">—</span>
                          ) : (
                            <span style={{ fontWeight: 600, color: isAhead ? 'var(--neg)' : isBehind ? 'var(--pos)' : 'var(--t3)' }}>
                              {isAhead ? '+' : ''}{delta.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!entry.isYou && (
                            <button
                              onClick={() => handleRemove(entry.id as string)}
                              disabled={removingId === entry.id}
                              className="btn btn-quiet btn-sm"
                              style={{ padding: '0 6px', opacity: removingId === entry.id ? 0.4 : 1 }}
                              title="Remove competitor"
                            >
                              <IconTrash s={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <p className="t-serif t-italic c-t3" style={{ fontSize: 18, marginBottom: 6 }}>No competitors tracked yet.</p>
              <p className="t-xs c-t3">Search above, or use auto-discover to find nearby restaurants.</p>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
