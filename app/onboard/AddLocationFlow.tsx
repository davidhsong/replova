'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { getSupabaseBrowser } from '@/lib/supabase'

type PlaceResult = { placeId: string; name: string; address: string }

export default function AddLocationFlow({ connectAfterAdd }: { connectAfterAdd: boolean }) {
  const [sessionReady, setSessionReady] = useState(false)
  const [businessName, setBusinessName] = useState('')
  const [city, setCity] = useState('')
  const [result, setResult] = useState<PlaceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await getSupabaseBrowser().auth.getUser()
      if (!data.user?.email) {
        const next = connectAfterAdd
          ? '/onboard?add=true&intent=google'
          : '/onboard?add=true'
        window.location.replace(`/signin?next=${encodeURIComponent(next)}`)
        return
      }
      setSessionReady(true)
    })()
  }, [connectAfterAdd])

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const params = new URLSearchParams({ name: businessName.trim(), city: city.trim() })
      const response = await fetch(`/api/onboard/search-place?${params}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Search failed.')
      if (!data.found) {
        setError('No matching location was found. Check the spelling and city, then try again.')
        return
      }
      setResult({ placeId: data.placeId, name: data.name, address: data.address })
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  async function addLocation() {
    if (!result) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name, placeId: result.placeId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Unable to add this location.')
      window.location.replace(connectAfterAdd ? '/api/auth/google' : '/dashboard')
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add this location.')
      setLoading(false)
    }
  }

  return (
    <main id="main-content" className="location-onboarding-shell">
      <header className="account-onboarding-header">
        <Link href="/dashboard" aria-label="Replova dashboard">
          <ReplovaLogo variant="primary" surface="light" height={25} decorative eager />
        </Link>
        <p><Link href="/dashboard">Back to dashboard</Link></p>
      </header>

      <section className="location-onboarding-content" aria-labelledby="location-title">
        <p className="t-eyebrow">Optional setup</p>
        <h1 id="location-title">
          {connectAfterAdd ? 'Choose the location to connect' : 'Add a business location'}
        </h1>
        <p>
          Search Google Places for the location you manage. Adding it does not connect Google
          or publish anything; authorization remains a separate step.
        </p>

        {!result ? (
          <form onSubmit={search} className="location-onboarding-form">
            <div className="account-onboarding-field">
              <label htmlFor="location-name">Business name</label>
              <input
                id="location-name"
                required
                maxLength={200}
                value={businessName}
                onChange={event => setBusinessName(event.target.value)}
                placeholder="Northstar Auto Care"
                autoFocus
              />
            </div>
            <div className="account-onboarding-field">
              <label htmlFor="location-city">City</label>
              <input
                id="location-city"
                required
                maxLength={160}
                value={city}
                onChange={event => setCity(event.target.value)}
                placeholder="Portland"
              />
            </div>
            {error && <p className="account-onboarding-error" role="alert">{error}</p>}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!sessionReady || loading || !businessName.trim() || !city.trim()}
            >
              {loading ? 'Searching...' : 'Find location'}
            </button>
          </form>
        ) : (
          <div className="location-confirmation">
            <div>
              <p className="t-eyebrow">Confirm location</p>
              <h2>{result.name}</h2>
              <p>{result.address}</p>
            </div>
            {error && <p className="account-onboarding-error" role="alert">{error}</p>}
            <div className="location-confirmation-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setResult(null); setError(null) }} disabled={loading}>
                Search again
              </button>
              <button type="button" className="btn btn-primary" onClick={addLocation} disabled={loading}>
                {loading ? 'Adding location...' : connectAfterAdd ? 'Add and continue to Google' : 'Add location'}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
