'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { IconRefresh, IconSignOut } from '@/components/icons'
import { getSupabaseBrowser } from '@/lib/supabase'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type YouTubeStatus = 'loading' | 'not_connected' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }
type YouTubeComment = {
  id: string
  threadId: string
  videoId: string
  author: string
  text: string
  date: string
  replyCount: number
  published: boolean | null
  publishedReplyId: string | null
  publishedReplyUrl: string | null
}

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
  const [hasRestaurant, setHasRestaurant] = useState<boolean | null>(null)
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('loading')
  const [googleNotice, setGoogleNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus>('loading')
  const [youtubeChannelTitle, setYoutubeChannelTitle] = useState<string | null>(null)
  const [youtubeNotice, setYoutubeNotice] = useState<{ ok: boolean; message: string } | null>(null)
  const [disconnectingYoutube, setDisconnectingYoutube] = useState(false)
  const [youtubeComments, setYoutubeComments] = useState<YouTubeComment[]>([])
  const [youtubeCommentsLoaded, setYoutubeCommentsLoaded] = useState(false)
  const [youtubeCommentsLoading, setYoutubeCommentsLoading] = useState(false)
  const [youtubeCommentsError, setYoutubeCommentsError] = useState<string | null>(null)
  const [youtubeCommentsNextPage, setYoutubeCommentsNextPage] = useState<string | null>(null)
  const [youtubeCommentsWarning, setYoutubeCommentsWarning] = useState<string | null>(null)
  const [youtubeSyncing, setYoutubeSyncing] = useState(false)
  const [youtubeSyncResult, setYoutubeSyncResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [youtubeAutomationLoaded, setYoutubeAutomationLoaded] = useState(false)
  const [youtubeAutoDraftEnabled, setYoutubeAutoDraftEnabled] = useState(false)
  const [youtubeAutoDraftSaving, setYoutubeAutoDraftSaving] = useState(false)
  const [youtubeDrafting, setYoutubeDrafting] = useState(false)
  const [youtubeDraftResult, setYoutubeDraftResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [youtubeReplyDrafts, setYoutubeReplyDrafts] = useState<Record<string, string>>({})
  const [youtubeReplyLoading, setYoutubeReplyLoading] = useState<Record<string, boolean>>({})
  const [youtubeReplyErrors, setYoutubeReplyErrors] = useState<Record<string, string>>({})
  const [youtubePublishLoading, setYoutubePublishLoading] = useState<Record<string, boolean>>({})
  const [youtubePublishErrors, setYoutubePublishErrors] = useState<Record<string, string>>({})
  const [youtubePublished, setYoutubePublished] = useState<Record<string, { replyUrl: string | null }>>({})
  const [youtubePublishBlocked, setYoutubePublishBlocked] = useState<Record<string, string>>({})
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
    if (youtubeStatus !== 'connected') return
    setYoutubeAutomationLoaded(false)
    fetch('/api/youtube/automation/settings', { cache: 'no-store' })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Could not load automatic drafting settings.')
        setYoutubeAutoDraftEnabled(data.automaticDraftingEnabled === true)
      })
      .catch(error => setYoutubeDraftResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not load automatic drafting settings.',
      }))
      .finally(() => setYoutubeAutomationLoaded(true))
  }, [youtubeStatus])

  useEffect(() => {
    void (async () => {
      const { data } = await getSupabaseBrowser().auth.getUser()
      setEmail(data.user?.email ?? '')
    })()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('google_success')
    const warning = params.get('google_warning')
    const oauthError = params.get('google_error')

    fetch('/api/restaurant')
      .then(async response => {
        if (response.status === 404) {
          setHasRestaurant(false)
          setSettingsLoaded(true)
          return null
        }

        setHasRestaurant(true)
        const data = await response.json()
        if (response.ok) {
          fetch('/api/settings')
            .then(settingsResponse => settingsResponse.json())
            .then(settings => {
              if (!settings.error) {
                setReplySettings({
                  auto_reply_enabled: settings.auto_reply_enabled ?? false,
                  auto_reply_delay_hours: settings.auto_reply_delay_hours ?? 2,
                })
              }
            })
            .finally(() => setSettingsLoaded(true))
        } else {
          setSettingsLoaded(true)
        }
        return data
      })
      .then(data => {
        if (!data) return
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
      .catch(() => {
        setHasRestaurant(true)
        setSettingsLoaded(true)
        setGoogleStatus('not_connected')
      })
  }, [loadLocations])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('youtube_success')
    const oauthError = params.get('youtube_error')
    let oauthNotice: { ok: boolean; message: string } | null = null
    if (success) oauthNotice = { ok: true, message: 'YouTube connected.' }
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'YouTube connection was cancelled.',
        state_mismatch: 'The YouTube security check failed. Try connecting again.',
        session_expired: 'Your session expired. Sign in and try again.',
        not_configured: 'YouTube is not configured yet.',
        token_exchange_failed: 'YouTube connection failed. Try again.',
        missing_permissions: 'The required YouTube permission was not granted.',
        missing_refresh_token: 'Google did not return offline access. Try connecting again.',
        channel_lookup_failed: 'Replova could not load your YouTube channel.',
        channel_not_found: 'No YouTube channel was found for that Google account.',
        save_failed: 'YouTube connected, but Replova could not save the connection.',
      }
      oauthNotice = { ok: false, message: messages[oauthError] ?? 'YouTube connection failed.' }
    }

    fetch('/api/auth/youtube/status')
      .then(response => response.json())
      .then(data => {
        if (oauthNotice) setYoutubeNotice(oauthNotice)
        setYoutubeStatus(data.connected ? 'connected' : 'not_connected')
        setYoutubeChannelTitle(data.channelTitle ?? null)
      })
      .catch(() => setYoutubeStatus('not_connected'))
  }, [])

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

  async function disconnectYoutube() {
    setDisconnectingYoutube(true)
    setYoutubeNotice(null)
    try {
      const response = await fetch('/api/auth/youtube/disconnect', { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not disconnect YouTube.')
      setYoutubeStatus('not_connected')
      setYoutubeChannelTitle(null)
      setYoutubeComments([])
      setYoutubeCommentsLoaded(false)
      setYoutubeCommentsNextPage(null)
      setYoutubeCommentsWarning(null)
      setYoutubeSyncResult(null)
      setYoutubeAutomationLoaded(false)
      setYoutubeAutoDraftEnabled(false)
      setYoutubeDraftResult(null)
      setYoutubeReplyDrafts({})
      setYoutubeReplyLoading({})
      setYoutubeReplyErrors({})
      setYoutubePublishLoading({})
      setYoutubePublishErrors({})
      setYoutubePublished({})
      setYoutubePublishBlocked({})
      setYoutubeNotice({ ok: true, message: 'YouTube disconnected from Replova.' })
    } catch (error) {
      setYoutubeNotice({ ok: false, message: error instanceof Error ? error.message : 'Could not disconnect YouTube.' })
    } finally {
      setDisconnectingYoutube(false)
    }
  }

  async function fetchYoutubeComments(pageToken?: string) {
    setYoutubeCommentsLoading(true)
    setYoutubeCommentsError(null)
    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''
      const response = await fetch(`/api/youtube/comments${query}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not fetch YouTube comments.')

      const comments = Array.isArray(data.comments) ? data.comments as YouTubeComment[] : []
      setYoutubeComments(current => pageToken ? [...current, ...comments] : comments)
      setYoutubeCommentsNextPage(typeof data.nextPageToken === 'string' ? data.nextPageToken : null)
      setYoutubeCommentsWarning(current => data.replyVerificationWarning === true
        ? 'Some reply statuses could not be verified. Publishing is disabled for those comments.'
        : pageToken ? current : null)
      setYoutubePublished(current => {
        const next = pageToken ? { ...current } : {}
        for (const comment of comments) {
          if (comment.published) next[comment.id] = { replyUrl: comment.publishedReplyUrl }
        }
        return next
      })
      setYoutubePublishBlocked(current => {
        const next = pageToken ? { ...current } : {}
        for (const comment of comments) {
          if (comment.published === null) next[comment.id] = 'Status unavailable'
        }
        return next
      })
      setYoutubeCommentsLoaded(true)
    } catch (error) {
      setYoutubeCommentsError(error instanceof Error ? error.message : 'Could not fetch YouTube comments.')
    } finally {
      setYoutubeCommentsLoading(false)
    }
  }

  async function syncYoutubeComments() {
    setYoutubeSyncing(true)
    setYoutubeSyncResult(null)
    try {
      const response = await fetch('/api/youtube/comments/sync', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not sync YouTube comments.')

      const details = [
        `${data.fetched ?? 0} fetched`,
        `${data.inserted ?? 0} new`,
        `${data.updated ?? 0} updated`,
        `${data.publishedDetected ?? 0} published ${data.publishedDetected === 1 ? 'reply' : 'replies'} detected`,
      ]
      if (data.verificationUnknown > 0) details.push(`${data.verificationUnknown} unverified`)
      setYoutubeSyncResult({
        ok: data.partial !== true,
        message: `Sync complete: ${details.join(' · ')}${data.partial === true ? '. Some results need another check.' : ''}`,
      })
    } catch (error) {
      setYoutubeSyncResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not sync YouTube comments.',
      })
    } finally {
      setYoutubeSyncing(false)
    }
  }

  async function saveYoutubeAutoDraft(enabled: boolean) {
    setYoutubeAutoDraftSaving(true)
    setYoutubeDraftResult(null)
    try {
      const response = await fetch('/api/youtube/automation/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automaticDraftingEnabled: enabled }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save automatic drafting.')
      setYoutubeAutoDraftEnabled(data.automaticDraftingEnabled === true)
      setYoutubeDraftResult({
        ok: true,
        message: enabled
          ? 'Automatic drafting is enabled. Scheduling remains off until a worker is configured.'
          : 'Automatic drafting is disabled.',
      })
    } catch (error) {
      setYoutubeDraftResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not save automatic drafting.',
      })
    } finally {
      setYoutubeAutoDraftSaving(false)
    }
  }

  async function generatePendingYoutubeDrafts() {
    setYoutubeDrafting(true)
    setYoutubeDraftResult(null)
    try {
      const response = await fetch('/api/youtube/drafts/generate-pending', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not generate pending drafts.')
      const processed = (data.drafted ?? 0) + (data.skipped ?? 0) + (data.failed ?? 0)
      setYoutubeDraftResult({
        ok: (data.failed ?? 0) === 0,
        message: processed === 0
          ? 'No eligible verified comments are waiting for drafts.'
          : `Draft run complete: ${data.drafted ?? 0} drafted · ${data.skipped ?? 0} spam skipped · ${data.selfSkipped ?? 0} self-comments skipped · ${data.failed ?? 0} failed.`,
      })
    } catch (error) {
      setYoutubeDraftResult({
        ok: false,
        message: error instanceof Error ? error.message : 'Could not generate pending drafts.',
      })
    } finally {
      setYoutubeDrafting(false)
    }
  }

  async function generateYoutubeReply(comment: YouTubeComment, previousDraft?: string) {
    setYoutubeReplyLoading(current => ({ ...current, [comment.id]: true }))
    setYoutubeReplyErrors(current => {
      const next = { ...current }
      delete next[comment.id]
      return next
    })

    try {
      const response = await fetch('/api/youtube/replies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          author: comment.author,
          text: comment.text,
          ...(previousDraft ? { previousDraft } : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not generate a reply.')
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The AI returned an empty reply.')
      setYoutubeReplyDrafts(current => ({ ...current, [comment.id]: data.reply }))
    } catch (error) {
      setYoutubeReplyErrors(current => ({
        ...current,
        [comment.id]: error instanceof Error ? error.message : 'Could not generate a reply.',
      }))
    } finally {
      setYoutubeReplyLoading(current => ({ ...current, [comment.id]: false }))
    }
  }

  async function publishYoutubeReply(comment: YouTubeComment) {
    const replyText = youtubeReplyDrafts[comment.id]?.trim()
    if (!replyText || youtubePublished[comment.id] || youtubePublishBlocked[comment.id] || youtubePublishLoading[comment.id]) return

    setYoutubePublishLoading(current => ({ ...current, [comment.id]: true }))
    setYoutubePublishErrors(current => {
      const next = { ...current }
      delete next[comment.id]
      return next
    })

    try {
      const response = await fetch('/api/youtube/replies/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId: comment.id,
          threadId: comment.threadId,
          replyText,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.blocked === true) {
          setYoutubePublishBlocked(current => ({
            ...current,
            [comment.id]: data.uncertain === true ? 'Check YouTube' : 'Already replied',
          }))
        }
        throw new Error(data.error ?? 'Could not publish the reply.')
      }

      setYoutubePublished(current => ({
        ...current,
        [comment.id]: { replyUrl: typeof data.replyUrl === 'string' ? data.replyUrl : null },
      }))
      setYoutubeComments(current => current.map(item => item.id === comment.id
        ? { ...item, replyCount: item.replyCount + 1 }
        : item))
    } catch (error) {
      setYoutubePublishErrors(current => ({
        ...current,
        [comment.id]: error instanceof Error ? error.message : 'Could not publish the reply.',
      }))
    } finally {
      setYoutubePublishLoading(current => ({ ...current, [comment.id]: false }))
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
        <p>{hasRestaurant === false ? 'Manage your integrations and account.' : 'Connect Google and choose how replies move through Replova.'}</p>
      </header>

      <div className="page-body simple-settings">
        {hasRestaurant === true && <section className="simple-settings-section">
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
        </section>}

        <section className="simple-settings-section">
          <div className="simple-section-heading">
            <div>
              <span>{hasRestaurant === false ? '01' : '02'}</span>
              <h2>YouTube</h2>
              <p>Connect the channel whose comments you want Replova to manage.</p>
            </div>
          </div>

          {youtubeNotice && (
            <p className={`simple-message ${youtubeNotice.ok ? 'is-success' : 'is-error'}`}>{youtubeNotice.message}</p>
          )}
          {youtubeStatus === 'loading' && <div className="settings-loading-line skeleton" />}
          {youtubeStatus === 'connected' && (
            <>
              <div className="simple-connection-row">
                <div>
                  <strong><i className="connection-dot" /> Connected</strong>
                  <span>{youtubeChannelTitle ?? 'YouTube channel'}</span>
                </div>
                <button type="button" className="text-link" onClick={disconnectYoutube} disabled={disconnectingYoutube}>
                  {disconnectingYoutube ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
              <div className="simple-setting-row">
                <div>
                  <strong>Automatic drafting</strong>
                  <span>Draft verified unanswered comments when an automation worker runs. Auto-publishing stays off.</span>
                </div>
                <Toggle
                  on={youtubeAutoDraftEnabled}
                  onChange={saveYoutubeAutoDraft}
                  disabled={!youtubeAutomationLoaded || youtubeAutoDraftSaving}
                />
              </div>
              <div className="youtube-comments-controls">
                <a href="/dashboard/youtube/replies" className="btn btn-primary btn-sm">Open Reply Queue</a>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={syncYoutubeComments}
                  disabled={youtubeSyncing}
                >
                  <span className={youtubeSyncing ? 'spin' : undefined}><IconRefresh s={12} /></span>
                  {youtubeSyncing ? 'Syncing…' : 'Sync Comments'}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={generatePendingYoutubeDrafts}
                  disabled={youtubeDrafting}
                >
                  <span className={youtubeDrafting ? 'spin' : undefined}><IconRefresh s={12} /></span>
                  {youtubeDrafting ? 'Generating…' : 'Generate Pending Drafts'}
                </button>
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={() => fetchYoutubeComments()}
                  disabled={youtubeCommentsLoading}
                >
                  <span className={youtubeCommentsLoading ? 'spin' : undefined}><IconRefresh s={12} /></span>
                  {youtubeCommentsLoading && !youtubeCommentsLoaded ? 'Fetching…' : 'Fetch Comments'}
                </button>
              </div>
              {youtubeSyncResult && (
                <p className={`simple-message ${youtubeSyncResult.ok ? 'is-success' : 'is-error'}`} role="status">
                  {youtubeSyncResult.message}
                </p>
              )}
              {youtubeDraftResult && (
                <p className={`simple-message ${youtubeDraftResult.ok ? 'is-success' : 'is-error'}`} role="status">
                  {youtubeDraftResult.message}
                </p>
              )}
              {youtubeCommentsError && <p className="simple-message is-error">{youtubeCommentsError}</p>}
              {youtubeCommentsWarning && <p className="simple-message is-error">{youtubeCommentsWarning}</p>}
              {youtubeCommentsLoaded && youtubeComments.length === 0 && !youtubeCommentsError && (
                <p className="simple-message">No published comments were found for this channel.</p>
              )}
              {youtubeComments.length > 0 && (
                <div className="youtube-comments-list" aria-live="polite">
                  {youtubeComments.map(comment => (
                    <article key={comment.id} className="youtube-comment">
                      <div className="youtube-comment-meta">
                        <strong>{comment.author}</strong>
                        <time dateTime={comment.date}>{new Date(comment.date).toLocaleString()}</time>
                      </div>
                      <p>{comment.text}</p>
                      <div className="youtube-comment-footer">
                        <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(comment.videoId)}`} target="_blank" rel="noreferrer">View video</a>
                        <span>{comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}</span>
                      </div>
                      <div className="youtube-comment-ai">
                        {youtubePublished[comment.id] ? (
                          <div className="youtube-comment-ai-actions">
                            <button type="button" className="btn btn-primary btn-sm" disabled>Published</button>
                            {youtubePublished[comment.id].replyUrl && (
                              <a href={youtubePublished[comment.id].replyUrl!} target="_blank" rel="noreferrer">View published reply</a>
                            )}
                          </div>
                        ) : comment.published === null ? (
                          <p className="youtube-comment-ai-error" role="status">Reply status could not be verified. Publishing is disabled.</p>
                        ) : youtubeReplyDrafts[comment.id] ? (
                          <>
                            <label htmlFor={`youtube-reply-${comment.id}`}>AI reply draft</label>
                            <textarea
                              id={`youtube-reply-${comment.id}`}
                              value={youtubeReplyDrafts[comment.id]}
                              onChange={event => setYoutubeReplyDrafts(current => ({
                                ...current,
                                [comment.id]: event.target.value.slice(0, 1000),
                              }))}
                              maxLength={1000}
                              rows={4}
                              disabled={Boolean(youtubePublished[comment.id])}
                            />
                            <div className="youtube-comment-ai-actions">
                              <button
                                type="button"
                                className="btn btn-quiet btn-sm"
                                onClick={() => generateYoutubeReply(comment, youtubeReplyDrafts[comment.id])}
                                disabled={youtubeReplyLoading[comment.id] || Boolean(youtubePublished[comment.id]) || youtubePublishLoading[comment.id]}
                              >
                                {youtubeReplyLoading[comment.id] ? 'Regenerating…' : 'Regenerate'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => publishYoutubeReply(comment)}
                                disabled={youtubePublishLoading[comment.id] || Boolean(youtubePublished[comment.id]) || Boolean(youtubePublishBlocked[comment.id]) || !youtubeReplyDrafts[comment.id].trim()}
                              >
                                {youtubePublished[comment.id]
                                  ? 'Published'
                                  : youtubePublishBlocked[comment.id]
                                    ? youtubePublishBlocked[comment.id]
                                    : youtubePublishLoading[comment.id] ? 'Publishing…' : 'Publish Reply'}
                              </button>
                              {youtubePublished[comment.id]?.replyUrl && (
                                <a href={youtubePublished[comment.id].replyUrl!} target="_blank" rel="noreferrer">View published reply</a>
                              )}
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-quiet btn-sm"
                            onClick={() => generateYoutubeReply(comment)}
                            disabled={youtubeReplyLoading[comment.id]}
                          >
                            {youtubeReplyLoading[comment.id] ? 'Generating…' : 'Generate AI Reply'}
                          </button>
                        )}
                        {youtubeReplyErrors[comment.id] && (
                          <p className="youtube-comment-ai-error" role="alert">{youtubeReplyErrors[comment.id]}</p>
                        )}
                        {youtubePublishErrors[comment.id] && (
                          <p className="youtube-comment-ai-error" role="alert">{youtubePublishErrors[comment.id]}</p>
                        )}
                      </div>
                    </article>
                  ))}
                  {youtubeCommentsNextPage && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm youtube-comments-more"
                      onClick={() => fetchYoutubeComments(youtubeCommentsNextPage)}
                      disabled={youtubeCommentsLoading}
                    >
                      {youtubeCommentsLoading ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {youtubeStatus === 'not_connected' && (
            <div className="simple-empty-row">
              <p>Authorize Replova to access comments and publish replies on your channel.</p>
              <a href="/api/auth/youtube" className="btn btn-primary">Connect YouTube</a>
            </div>
          )}
        </section>

        {hasRestaurant === true && <section className="simple-settings-section">
          <div className="simple-section-heading">
            <div>
              <span>03</span>
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
        </section>}

        <section className="simple-settings-section simple-account-section">
          <div className="simple-section-heading">
            <div>
              <span>{hasRestaurant === false ? '02' : '04'}</span>
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
