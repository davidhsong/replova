'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconRefresh, IconSignOut } from '@/components/icons'
import { getSupabaseBrowser } from '@/lib/supabase'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }

function Toggle({ on, onChange, disabled = false }: {
  on: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className="simple-toggle"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      data-on={on}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('loading')
  const [googleNotice, setGoogleNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [locations, setLocations] = useState<GmbLocation[] | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsResult, setSettingsResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [replySettings, setReplySettings] = useState({
    auto_reply_enabled: false,
    auto_reply_delay_hours: 2,
  })

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true)
    try {
      const response = await fetch('/api/auth/google/locations')
      const data = await response.json()
      setLocations(data.locations ?? [])
    } catch {
      setLocations([])
    } finally {
      setLocationsLoading(false)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      const { data } = await getSupabaseBrowser().auth.getUser()
      setEmail(data.user?.email ?? '')
    })()
  }, [])

  useEffect(() => {
    fetch('/api/settings')
      .then(response => response.json())
      .then(data => {
        if (!data.error) {
          setReplySettings({
            auto_reply_enabled: data.auto_reply_enabled ?? false,
            auto_reply_delay_hours: data.auto_reply_delay_hours ?? 2,
          })
        }
      })
      .finally(() => setSettingsLoaded(true))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('google_success')
    const warning = params.get('google_warning')
    const oauthError = params.get('google_error')

    fetch('/api/restaurant')
      .then(response => response.json())
      .then(data => {
        if (success && warning === 'location_not_found') {
          setGoogleStatus('token_only')
          void loadLocations()
          return
        }

        if (success) {
          setGoogleNotice({ ok: true, message: 'Google Business connected.' })
          setGoogleStatus('connected')
          return
        }

        if (oauthError) {
          const messages: Record<string, string> = {
            access_denied: 'Google connection was cancelled.',
            token_exchange_failed: 'Google connection failed. Try again.',
            missing_tokens: 'Google did not return the required permissions.',
            state_mismatch: 'The security check failed. Try connecting again.',
            restaurant_not_found: 'We could not find this business.',
            invalid_callback: 'Google returned an invalid callback.',
            not_configured: 'Google Business is not configured yet.',
            save_failed: 'Google connected, but Replova could not save the connection.',
          }
          setGoogleNotice({ ok: false, message: messages[oauthError] ?? 'Google connection failed.' })
        }

        if (data.googleConnected) setGoogleStatus('connected')
        else if (data.googleTokenOnly) {
          setGoogleStatus('token_only')
          void loadLocations()
        } else setGoogleStatus('not_connected')
      })
      .catch(() => setGoogleStatus('not_connected'))
  }, [loadLocations])

  async function selectLocation(locationName: string) {
    setSavingLocation(true)
    setGoogleNotice(null)
    try {
      const response = await fetch('/api/auth/google/set-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationName }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save this location.')
      setGoogleStatus('connected')
      setLocations(null)
      setGoogleNotice({ ok: true, message: 'Google Business location connected.' })
      router.refresh()
    } catch (error) {
      setGoogleNotice({ ok: false, message: error instanceof Error ? error.message : 'Could not save this location.' })
    } finally {
      setSavingLocation(false)
    }
  }

  async function syncReviews() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const response = await fetch('/api/sync-reviews', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Sync failed.')
      setSyncResult({
        ok: true,
        message: `${data.newlyStored} new review${data.newlyStored === 1 ? '' : 's'} · ${data.repliesGenerated} draft${data.repliesGenerated === 1 ? '' : 's'} generated`,
      })
      router.refresh()
    } catch (error) {
      setSyncResult({ ok: false, message: error instanceof Error ? error.message : 'Sync failed.' })
    } finally {
      setSyncing(false)
    }
  }

  async function saveReplySettings() {
    setSavingSettings(true)
    setSettingsResult(null)
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replySettings),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save settings.')
      setSettingsResult({ ok: true, message: 'Saved.' })
      router.refresh()
    } catch (error) {
      setSettingsResult({ ok: false, message: error instanceof Error ? error.message : 'Could not save settings.' })
    } finally {
      setSavingSettings(false)
    }
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut()
    window.location.replace('/signin')
  }

  return (
    <>
      <header className="page-header product-page-header">
        <div className="t-eyebrow">Workspace / Settings</div>
        <h1>Settings</h1>
        <p>Connect Google and choose how replies move through Replova.</p>
      </header>

      <div className="page-body simple-settings">
        <section className="simple-settings-section">
          <div className="simple-section-heading">
            <div>
              <span>01</span>
              <h2>Google Business</h2>
              <p>Required to import reviews and publish replies.</p>
            </div>
            {googleStatus === 'connected' && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={syncReviews} disabled={syncing}>
                <span className={syncing ? 'spin' : undefined}><IconRefresh s={12} /></span>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            )}
          </div>

          {googleNotice && (
            <p className={`simple-message ${googleNotice.ok ? 'is-success' : 'is-error'}`}>{googleNotice.message}</p>
          )}
          {syncResult && (
            <p className={`simple-message ${syncResult.ok ? 'is-success' : 'is-error'}`}>{syncResult.message}</p>
          )}

          {googleStatus === 'loading' && <div className="settings-loading-line skeleton" />}

          {googleStatus === 'connected' && (
            <div className="simple-connection-row">
              <div>
                <strong><i className="connection-dot" /> Connected</strong>
                <span>Reviews sync automatically every six hours.</span>
              </div>
              <a href="/api/auth/google" className="text-link">Reconnect</a>
            </div>
          )}

          {googleStatus === 'not_connected' && (
            <div className="simple-empty-row">
              <p>Connect the Google account that manages this Business Profile.</p>
              <a href="/api/auth/google" className="btn btn-primary">Connect Google Business</a>
            </div>
          )}

          {googleStatus === 'token_only' && (
            <div className="location-picker">
              <p>Select the location you want Replova to manage.</p>
              {locationsLoading && <div className="settings-loading-line skeleton" />}
              {!locationsLoading && locations?.length === 0 && (
                <p className="simple-message is-error">No Google Business locations were found. <a href="/api/auth/google">Reconnect</a></p>
              )}
              {!locationsLoading && locations && locations.length > 0 && (
                <div className="location-list">
                  {locations.map(location => (
                    <button key={location.name} type="button" onClick={() => selectLocation(location.name)} disabled={savingLocation}>
                      <strong>{location.title}</strong>
                      <span>{location.placeId ?? 'Google Business location'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="simple-settings-section">
          <div className="simple-section-heading">
            <div>
              <span>02</span>
              <h2>Reply automation</h2>
              <p>Keep replies manual, or automatically send safe high-rating responses.</p>
            </div>
          </div>

          {!settingsLoaded ? (
            <div className="settings-loading-line skeleton" />
          ) : (
            <div className="simple-setting-rows">
              <div className="simple-setting-row">
                <div><strong>Auto-reply</strong><span>Only positive 4- and 5-star reviews.</span></div>
                <Toggle
                  on={replySettings.auto_reply_enabled}
                  onChange={value => setReplySettings(current => ({ ...current, auto_reply_enabled: value }))}
                  disabled={savingSettings}
                />
              </div>
              <label className="simple-setting-row" htmlFor="replyDelay">
                <div><strong>Send delay</strong><span>Wait before publishing an automatic reply.</span></div>
                <select
                  id="replyDelay"
                  value={replySettings.auto_reply_delay_hours}
                  onChange={event => setReplySettings(current => ({ ...current, auto_reply_delay_hours: Number(event.target.value) }))}
                >
                  {[1, 2, 4, 8, 12, 24].map(hours => <option key={hours} value={hours}>{hours} hour{hours === 1 ? '' : 's'}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="simple-settings-actions">
            <button type="button" className="btn btn-primary" onClick={saveReplySettings} disabled={!settingsLoaded || savingSettings}>
              {savingSettings ? 'Saving…' : 'Save changes'}
            </button>
            {settingsResult && <span className={settingsResult.ok ? 'c-pos' : 'c-neg'}>{settingsResult.message}</span>}
          </div>
        </section>

        <section className="simple-settings-section simple-account-section">
          <div className="simple-section-heading">
            <div>
              <span>03</span>
              <h2>Account</h2>
              <p>{email || 'Signed-in account'}</p>
            </div>
            <button type="button" className="btn btn-quiet btn-sm" onClick={signOut}><IconSignOut s={13} /> Sign out</button>
          </div>
          <DeleteAccountControl />
        </section>
      </div>
    </>
  )
}

function DeleteAccountControl() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteAccount() {
    setDeleting(true)
    setError(null)
    try {
      const response = await fetch('/api/account/delete', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Account deletion failed.')
      await getSupabaseBrowser().auth.signOut()
      window.location.replace('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Account deletion failed.')
      setDeleting(false)
    }
  }

  if (!confirming) {
    return <button type="button" className="settings-delete-link" onClick={() => setConfirming(true)}>Delete account</button>
  }

  return (
    <div className="settings-delete-confirm">
      <p>This permanently removes the account, reviews, replies, and billing records.</p>
      {error && <span className="c-neg">{error}</span>}
      <div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(false)} disabled={deleting}>Cancel</button>
        <button type="button" className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete permanently'}</button>
      </div>
    </div>
  )
}
