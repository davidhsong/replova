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
  address: string | null
  website: string | null
  priceLevel: number | null
  cuisineTags: string[]
  source: 'manual' | 'auto'
  latestSnapshot: { avg_rating: number | null; total_reviews: number | null; snapshot_date: string } | null
}

function PriceLevel({ level }: { level: number | null }) {
  if (level === null) return null
  const filled = Math.max(1, Math.min(4, level))
  return (
    <span className="t-mono" style={{ fontSize: 11, color: 'var(--t2)', letterSpacing: '-0.01em' }}>
      {'$'.repeat(filled)}<span style={{ opacity: 0.25 }}>{'$'.repeat(4 - filled)}</span>
    </span>
  )
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
  const [clearingAll, setClearingAll] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
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
          const parts = []
          if (data.direct > 0) parts.push(`${data.direct} direct`)
          if (data.indirect > 0) parts.push(`${data.indirect} indirect`)
          setAutoDiscoverMsg(`Added ${data.added} competitor${data.added !== 1 ? 's' : ''} (${parts.join(', ')}) via AI.`)
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

  async function handleClearAll() {
    if (!restaurant) return
    setClearingAll(true)
    setConfirmClear(false)
    setError(null)
    try {
      const res = await fetch(`/api/competitors?all=true&restaurantId=${restaurant.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to clear competitors')
      } else {
        await loadData(restaurant.id)
      }
    } catch {
      setError('Failed to clear competitors')
    } finally {
      setClearingAll(false)
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

  if (authError) {
    return (
      <div className="page-body" style={{ textAlign: 'center', paddingTop: 64 }}>
        <p className="t-sm c-t3">Please sign in to view this page.</p>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--t3)' }}>Workspace</span>
          {' › '}
          <span>Competitors</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, flexWrap: 'wrap' }}>
          <h1 className="t-h1" style={{ marginBottom: 0 }}>Competitors</h1>
          {yourRank !== null && totalTracked > 0 && (
            <span className="t-body c-t3" style={{ lineHeight: 1 }}>
              Ranked{' '}
              <strong style={{ color: MEDAL_COLORS[yourRank] ?? 'var(--t1)' }}>#{yourRank}</strong>
              {' '}of {totalTracked}
              {yourEntry?.avgRating !== null && (
                <> · <strong style={{ color: 'var(--t1)' }}>{yourEntry?.avgRating?.toFixed(1)}★</strong></>
              )}
            </span>
          )}
        </div>
        <p className="t-sm c-t3" style={{ marginTop: 4 }}>
          {competitors.length} of {competitorLimit} slots used
        </p>
      </div>

      <div className="page-body">

        {/* Toolbar: search + auto-discover */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap' }}>

          {/* Search with dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400 }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', top: '50%', left: 11, transform: 'translateY(-50%)', color: 'var(--t4)', pointerEvents: 'none' }}>
                <IconSearch s={13} />
              </span>
              <input
                type="text"
                placeholder="Search Google Places to add a competitor…"
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
                        <button onClick={() => handleAdd(r.placeId)} disabled={isAdding || atLimit} className="btn btn-ghost btn-sm">
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
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            <span className={autoDiscovering ? 'spin' : undefined} style={{ display: 'inline-flex' }}>
              <IconRefresh s={11} />
            </span>
            {autoDiscovering ? 'Finding…' : 'Auto-discover nearby'}
          </button>

          {competitors.length > 0 && (
            confirmClear ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span className="t-xs c-t3">Remove all?</span>
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="btn btn-sm"
                  style={{ background: 'var(--neg)', color: '#fff', border: 'none' }}
                >
                  {clearingAll ? '…' : 'Yes, clear'}
                </button>
                <button onClick={() => setConfirmClear(false)} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="btn btn-ghost btn-sm"
                style={{ whiteSpace: 'nowrap', flexShrink: 0, color: 'var(--t3)' }}
              >
                Clear all
              </button>
            )
          )}
        </div>

        {/* Messages */}
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
        {atLimit && (
          <div className="banner banner-warn" style={{ marginBottom: 12 }}>
            Competitor limit reached.{' '}
            <a href="/dashboard/billing" style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>Upgrade to add more →</a>
          </div>
        )}

        {/* Table */}
        {allEntries.length > 0 ? (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="dtable" style={{ minWidth: 620 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Business</th>
                    <th style={{ width: 56 }}>Source</th>
                    <th style={{ width: 56 }}>Price</th>
                    <th style={{ width: 72, textAlign: 'right' }}>Rating</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Reviews</th>
                    <th style={{ width: 80, textAlign: 'right' }}>vs. You</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {allEntries.map((entry, i) => {
                    const delta = entry.ratingDelta
                    const isAhead = delta !== null && delta > 0
                    const isBehind = delta !== null && delta < 0
                    const comp = competitors.find(c => c.id === entry.id)
                    return (
                      <tr key={String(entry.id)} style={{ background: entry.isYou ? 'var(--accent-sub)' : undefined }}>
                        <td>
                          <span className="t-mono tnum" style={{ fontWeight: 700, fontSize: 12, color: MEDAL_COLORS[i + 1] ?? 'var(--t3)' }}>
                            #{i + 1}
                          </span>
                        </td>
                        <td style={{ maxWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span style={{
                              fontWeight: entry.isYou ? 700 : 500,
                              color: entry.isYou ? 'var(--accent)' : 'var(--t1)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1,
                            }}>
                              {entry.name}
                            </span>
                            {entry.isYou && <span className="pill pill-accent" style={{ height: 16, flexShrink: 0 }}>You</span>}
                            {comp?.website && (
                              <a href={comp.website} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', color: 'var(--t4)', flexShrink: 0 }}
                                title="Visit website">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                                </svg>
                              </a>
                            )}
                          </div>
                          {comp?.address && (
                            <div className="t-xs c-t4" style={{ marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {comp.address}
                            </div>
                          )}
                          {comp && comp.cuisineTags.length > 0 && (
                            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                              {comp.cuisineTags.slice(0, 3).map(tag => (
                                <span key={tag} style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 'var(--r-pill)', background: 'var(--surface-3)', color: 'var(--t3)', letterSpacing: '0.01em' }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {!entry.isYou && comp && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '2px 6px',
                              borderRadius: 'var(--r-pill)', display: 'inline-flex', alignItems: 'center',
                              background: comp.source === 'auto' ? 'var(--accent-sub)' : 'var(--surface-3)',
                              color: comp.source === 'auto' ? 'var(--accent)' : 'var(--t3)',
                              letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}>
                              {comp.source === 'auto' ? 'AI' : 'Manual'}
                            </span>
                          )}
                        </td>
                        <td>
                          {comp && <PriceLevel level={comp.priceLevel} />}
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
                              title="Remove"
                            >
                              <IconTrash s={12} />
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
        ) : (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p className="t-serif t-italic c-t3" style={{ fontSize: 18, marginBottom: 6 }}>No competitors tracked yet.</p>
            <p className="t-xs c-t3">Search above, or use auto-discover to find nearby competitors.</p>
          </div>
        )}

      </div>
    </>
  )
}
