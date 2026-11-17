'use client'

import { useEffect, useState } from 'react'
import { IconRefresh } from '@/components/icons'

type SelectedLocation = {
  id: string
  restaurant_id: string | null
  title: string
  account_resource_name: string
  location_resource_name: string
  review_parent_resource_name: string
}

type ConnectionStatus = {
  available: boolean
  availabilityCode: string
  availabilityMessage: string
  connected: boolean
  connectionStatus: string
  googleEmail: string | null
  legacyCredentialsPresent: boolean
  selectedLocations: SelectedLocation[]
  capabilities: {
    locationDiscovery: boolean
    reviewSync: boolean
    reviewPublishing: boolean
    automatedReplies: boolean
  }
}

type DiscoveredLocation = {
  accountResourceName: string
  accountName: string
  locationResourceName: string
  locationId: string
  reviewResourceName: string
  title: string
  placeId: string | null
  selected: boolean
  canonicalLinked: boolean
  restaurantId: string | null
}

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: 'Google connection was cancelled.',
  approval_required: 'Google Business Profile API access and permitted usage have not been confirmed yet.',
  disabled: 'Google Business Profile connection is currently disabled.',
  email_unverified: 'Verify your Replova email before connecting Google Business Profile.',
  invalid_callback: 'Google returned an invalid callback. Please try again.',
  invalid_redirect: 'The Google OAuth redirect is not configured safely.',
  identity_lookup_failed: 'Replova could not verify the authorized Google account. Please reconnect.',
  missing_permissions: 'The required Google Business Profile permission was not granted.',
  missing_refresh_token: 'Google did not return offline access. Reconnect and approve the requested permission.',
  not_configured: 'Google Business Profile OAuth is not fully configured.',
  save_failed: 'Google connected, but Replova could not save the encrypted connection.',
  state_create_failed: 'Replova could not start a secure Google connection. Please try again.',
  state_mismatch: 'The OAuth security check failed. Please start the connection again.',
  state_replayed: 'This Google connection link expired or was already used. Please start again.',
  token_exchange_failed: 'Google connection failed during authorization. Please try again.',
  workspace_mismatch: 'The Google connection did not match your active workspace.',
}

async function fetchConnectionStatus(): Promise<ConnectionStatus> {
  const response = await fetch('/api/auth/google/status', { cache: 'no-store' })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Could not load Google Business Profile status.')
  return data as ConnectionStatus
}

export default function GoogleBusinessWorkspaceSettings() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [locations, setLocations] = useState<DiscoveredLocation[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [discovering, setDiscovering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [locationLimit, setLocationLimit] = useState<number | null>(null)
  const [currentLocationCount, setCurrentLocationCount] = useState(0)

  async function loadStatus() {
    setLoading(true)
    try {
      setStatus(await fetchConnectionStatus())
    } catch (error) {
      setNotice({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not load Google Business Profile status.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('google_success') === 'true'
    const oauthError = params.get('google_error')
    void fetchConnectionStatus()
      .then(data => {
        if (!active) return
        setStatus(data)
        if (connected) {
          setNotice({ ok: true, message: 'Google Business Profile connected. Select the locations to manage.' })
        } else if (oauthError) {
          setNotice({ ok: false, message: OAUTH_ERRORS[oauthError] ?? 'Google connection failed.' })
        }
      })
      .catch(error => {
        if (!active) return
        setNotice({
          ok: false,
          message: error instanceof Error ? error.message : 'Could not load Google Business Profile status.',
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function discoverLocations() {
    setDiscovering(true)
    setNotice(null)
    try {
      const response = await fetch('/api/auth/google/locations', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not load Google Business Profile locations.')
      const nextLocations = Array.isArray(data.locations) ? data.locations as DiscoveredLocation[] : []
      setLocations(nextLocations)
      setChosen(new Set(nextLocations.filter(location => location.selected).map(location => location.reviewResourceName)))
      setLocationLimit(typeof data.locationLimit === 'number' ? data.locationLimit : null)
      setCurrentLocationCount(typeof data.currentLocationCount === 'number' ? data.currentLocationCount : 0)
      if (nextLocations.length === 0) {
        setNotice({
          ok: false,
          message: 'No Business Profile locations were returned for this Google account. Confirm the account has manager access.',
        })
      }
    } catch (error) {
      setLocations(null)
      setNotice({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not load Google Business Profile locations.',
      })
    } finally {
      setDiscovering(false)
    }
  }

  function toggleLocation(resourceName: string, alreadySelected: boolean) {
    if (alreadySelected) return
    setChosen(current => {
      const next = new Set(current)
      if (next.has(resourceName)) next.delete(resourceName)
      else next.add(resourceName)
      return next
    })
  }

  async function saveLocations() {
    const existing = new Set(locations?.filter(location => location.selected).map(location => location.reviewResourceName))
    const additions = [...chosen].filter(resource => !existing.has(resource))
    if (additions.length === 0) {
      setNotice({ ok: false, message: 'Select at least one new location to add.' })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const response = await fetch('/api/auth/google/set-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewResourceNames: additions }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not link Google Business Profile locations.')
      setNotice({
        ok: true,
        message: `${data.linked?.length ?? additions.length} location${(data.linked?.length ?? additions.length) === 1 ? '' : 's'} added to this workspace.`,
      })
      await loadStatus()
      await discoverLocations()
      setNotice({
        ok: true,
        message: `${data.linked?.length ?? additions.length} location${(data.linked?.length ?? additions.length) === 1 ? '' : 's'} added to this workspace.`,
      })
    } catch (error) {
      setNotice({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not link Google Business Profile locations.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Google Business Profile from this workspace? Reviews and location records will be preserved.')) return
    setDisconnecting(true)
    setNotice(null)
    try {
      const response = await fetch('/api/auth/google/disconnect', { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not disconnect Google Business Profile.')
      setLocations(null)
      setChosen(new Set())
      setNotice({
        ok: true,
        message: data.warning ?? 'Google Business Profile disconnected. Existing reviews and locations were preserved.',
      })
      await loadStatus()
    } catch (error) {
      setNotice({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not disconnect Google Business Profile.',
      })
    } finally {
      setDisconnecting(false)
    }
  }

  const connected = status?.connected === true
  const existingResources = new Set(locations?.filter(location => location.selected).map(location => location.reviewResourceName))
  const additions = [...chosen].filter(resource => !existingResources.has(resource)).length
  const newCanonicalLocationIds = new Set(
    (locations ?? [])
      .filter(location => chosen.has(location.reviewResourceName) && !location.selected && !location.canonicalLinked)
      .map(location => location.locationId)
  )
  const wouldExceedLimit = locationLimit !== null
    && currentLocationCount + newCanonicalLocationIds.size > locationLimit

  return (
    <section className="simple-settings-section google-business-workspace">
      <div className="simple-section-heading">
        <div>
          <span>01</span>
          <h2>Google Business Profile</h2>
          <p>Primary integration for authorized review locations and reputation management.</p>
        </div>
      </div>

      {notice && (
        <p className={`simple-message ${notice.ok ? 'is-success' : 'is-error'}`} role="status">
          {notice.message}
        </p>
      )}

      {loading && <div className="settings-loading-line skeleton" />}

      {!loading && status && !status.available && (
        <div className="google-availability-panel">
          <strong>Connection access is gated</strong>
          <p>{status.availabilityMessage}</p>
          <span>Replova will not request Google access until API approval, quota, and permitted third-party usage are confirmed.</span>
        </div>
      )}

      {!loading && status?.available && !connected && (
        <div className="simple-empty-row">
          <div>
            <p>Connect the Google account authorized to manage this workspace&apos;s Business Profile locations.</p>
            {status.legacyCredentialsPresent && (
              <span className="google-legacy-note">An existing location connection was detected. Reconnect to secure it at workspace level.</span>
            )}
          </div>
          <a href="/api/auth/google" className="btn btn-primary">Connect Google Business</a>
        </div>
      )}

      {!loading && connected && (
        <>
          <div className="simple-connection-row">
            <div>
              <strong><i className="connection-dot" /> Connected</strong>
              <span>{status.googleEmail ?? 'Authorized Google account'} · {status.selectedLocations.length} location{status.selectedLocations.length === 1 ? '' : 's'} selected</span>
            </div>
            <div className="google-connection-actions">
              <a href="/api/auth/google" className="text-link">Reconnect</a>
              <button type="button" className="text-link" onClick={disconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>

          <div className="google-capability-note">
            <strong>Safe connection phase</strong>
            <span>Location discovery is available. Review sync, publishing, and automatic replies remain disabled until separately approved and enabled.</span>
          </div>

          {status.available && (
            <div className="google-location-controls">
              <button type="button" className="btn btn-quiet btn-sm" onClick={discoverLocations} disabled={discovering || saving}>
                <span className={discovering ? 'spin' : undefined}><IconRefresh s={12} /></span>
                {discovering ? 'Loading locations…' : locations ? 'Refresh locations' : 'Choose locations'}
              </button>
              {locationLimit !== null && <span>{currentLocationCount} of {locationLimit} plan locations in use</span>}
            </div>
          )}

          {locations && locations.length > 0 && (
            <div className="google-location-list">
              {locations.map(location => {
                const checked = chosen.has(location.reviewResourceName)
                return (
                  <label key={location.reviewResourceName} className={location.selected ? 'is-selected' : undefined}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={location.selected || saving}
                      onChange={() => toggleLocation(location.reviewResourceName, location.selected)}
                    />
                    <span>
                      <strong>{location.title}</strong>
                      <small>{location.accountName}</small>
                      <code>{location.reviewResourceName}</code>
                    </span>
                    {location.selected && <em>Added</em>}
                  </label>
                )
              })}
              <div className="google-location-save">
                <span>{wouldExceedLimit ? 'This selection exceeds your plan location limit.' : `${additions} new Google association${additions === 1 ? '' : 's'} selected`}</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={saveLocations} disabled={saving || additions === 0 || wouldExceedLimit}>
                  {saving ? 'Adding…' : 'Add selected locations'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
