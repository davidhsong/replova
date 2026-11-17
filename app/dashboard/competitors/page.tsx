'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { IconRefresh, IconSearch, IconTrash } from '@/components/icons'

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

export default function CompetitorsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [comparison, setComparison] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [autoDiscovering, setAutoDiscovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async (restaurantId: string) => {
    const [competitorResponse, comparisonResponse] = await Promise.all([
      fetch(`/api/competitors?restaurantId=${restaurantId}`),
      fetch(`/api/competitors/comparison?restaurantId=${restaurantId}`),
    ])

    let count = 0
    if (competitorResponse.ok) {
      const list = await competitorResponse.json() as Competitor[]
      setCompetitors(list)
      count = list.length
    }
    if (comparisonResponse.ok) setComparison(await comparisonResponse.json())
    return count
  }, [])

  const discoverNearby = useCallback(async (restaurantId: string) => {
    if (autoDiscovering) return
    setAutoDiscovering(true)
    try {
      const response = await fetch('/api/competitors/auto-discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      })
      if (response.ok) await loadData(restaurantId)
    } finally {
      setAutoDiscovering(false)
    }
  }, [autoDiscovering, loadData])

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/restaurant')
        if (!response.ok) throw new Error('Unable to load this workspace.')
        const current = await response.json() as Restaurant
        setRestaurant(current)
        if (current.plan !== 'starter') {
          const count = await loadData(current.id)
          if (count === 0) await discoverNearby(current.id)
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Unable to load competitors.')
      } finally {
        setLoading(false)
      }
    })()
  // Initial workspace load only. Discovery is guarded internally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function closeDropdown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', closeDropdown)
    return () => document.removeEventListener('mousedown', closeDropdown)
  }, [])

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    try {
      const response = await fetch(`/api/competitors/search?q=${encodeURIComponent(query)}`)
      if (!response.ok) return
      const results = await response.json() as SearchResult[]
      setSearchResults(results)
      setShowDropdown(results.length > 0)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  function updateSearch(value: string) {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void search(value), 500)
  }

  async function addCompetitor(placeId: string) {
    if (!restaurant) return
    setAddingId(placeId)
    setError(null)
    try {
      const response = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: restaurant.id, placeId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Unable to add this competitor.')
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      await loadData(restaurant.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add this competitor.')
    } finally {
      setAddingId(null)
    }
  }

  async function removeCompetitor(competitorId: string) {
    if (!restaurant) return
    setRemovingId(competitorId)
    setError(null)
    try {
      const response = await fetch(`/api/competitors?competitorId=${competitorId}`, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Unable to remove this competitor.')
      await loadData(restaurant.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to remove this competitor.')
    } finally {
      setRemovingId(null)
    }
  }

  const limit = restaurant?.competitorLimit ?? 3
  const atLimit = competitors.length >= limit
  const entries = comparison
    ? [
        { ...comparison.yourRestaurant, id: 'you', ratingDelta: null, isYou: true },
        ...comparison.competitors.map(competitor => ({ ...competitor, isYou: false })),
      ].sort((left, right) => left.rank - right.rank)
    : []

  if (restaurant?.plan === 'starter') {
    return (
      <>
        <header className="page-header product-page-header">
          <div className="t-eyebrow">Workspace / Competitors</div>
          <h1>Competitors</h1>
          <p>Compare your Google rating with nearby businesses.</p>
        </header>
        <div className="page-body competitor-page-simple">
          <section className="simple-upgrade-block">
            <span>Growth feature</span>
            <h2>See how your reputation compares.</h2>
            <p>Competitor tracking is available on Growth and Agency plans.</p>
            <a href="/dashboard/billing" className="btn btn-primary">View plans</a>
          </section>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="page-header product-page-header">
        <div className="t-eyebrow">Workspace / Competitors</div>
        <h1>Competitors</h1>
        <p>{loading ? 'Loading…' : `${competitors.length} of ${limit} businesses tracked`}</p>
      </header>

      <div className="page-body competitor-page-simple">
        <div className="competitor-toolbar" ref={dropdownRef}>
          <div className="competitor-search">
            <IconSearch s={14} />
            <input
              type="search"
              value={searchQuery}
              onChange={event => updateSearch(event.target.value)}
              placeholder={atLimit ? 'Competitor limit reached' : 'Search Google Places'}
              disabled={atLimit}
              aria-label="Search Google Places for a competitor"
            />
            {searchLoading && <span className="spin"><IconRefresh s={13} /></span>}
          </div>

          {showDropdown && (
            <div className="competitor-search-results">
              {searchResults.map(result => {
                const added = competitors.some(competitor => competitor.googlePlaceId === result.placeId)
                return (
                  <div key={result.placeId}>
                    <span><strong>{result.name}</strong><small>{result.address}{result.rating !== null ? ` · ${result.rating.toFixed(1)}★` : ''}</small></span>
                    <button type="button" className="btn btn-quiet btn-sm" disabled={added || addingId === result.placeId} onClick={() => addCompetitor(result.placeId)}>
                      {added ? 'Added' : addingId === result.placeId ? 'Adding…' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="simple-message is-error">{error}</p>}
        {atLimit && <p className="simple-message">Limit reached. <a href="/dashboard/billing">View plans</a></p>}

        {entries.length > 0 ? (
          <div className="competitor-table-wrap">
            <table className="competitor-table">
              <thead>
                <tr><th>Rank</th><th>Business</th><th>Rating</th><th>Reviews</th><th>vs. you</th><th><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <tr key={entry.id} className={entry.isYou ? 'is-you' : undefined}>
                    <td>#{entry.rank}</td>
                    <td><strong>{entry.name}</strong>{entry.isYou && <span>You</span>}</td>
                    <td>{entry.avgRating !== null ? `${entry.avgRating.toFixed(1)}★` : 'N/A'}</td>
                    <td>{entry.totalReviews !== null ? entry.totalReviews.toLocaleString() : 'N/A'}</td>
                    <td className={entry.ratingDelta !== null && entry.ratingDelta > 0 ? 'is-behind' : entry.ratingDelta !== null && entry.ratingDelta < 0 ? 'is-ahead' : undefined}>
                      {entry.isYou || entry.ratingDelta === null ? 'N/A' : `${entry.ratingDelta > 0 ? '+' : ''}${entry.ratingDelta.toFixed(2)}`}
                    </td>
                    <td>
                      {!entry.isYou && (
                        <button type="button" className="competitor-remove" onClick={() => removeCompetitor(entry.id)} disabled={removingId === entry.id} aria-label={`Remove ${entry.name}`}>
                          <IconTrash s={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <div className="simple-empty-state">
            <h2>No competitors yet</h2>
            <p>Search above to add a nearby business.</p>
          </div>
        ) : (
          <div className="competitor-table-loading skeleton" />
        )}
      </div>
    </>
  )
}
