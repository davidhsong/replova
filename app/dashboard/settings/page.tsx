'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }

function SectionCard({ title, description, children, delay = 0 }: {
  title: string
  description?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <div className="card fade-up" style={{ padding: 24, marginBottom: 12, animationDelay: `${delay}ms` }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: description ? 4 : 0 }}>{title}</h2>
        {description && <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('loading')
  const [googleNotice, setGoogleNotice] = useState<string | null>(null)
  const [googleNoticeType, setGoogleNoticeType] = useState<'success' | 'error'>('success')
  const [locations, setLocations] = useState<GmbLocation[] | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const [replySettings, setReplySettings] = useState({
    auto_reply_enabled: false,
    auto_reply_delay_hours: 2,
    reply_persona: '',
    notify_negative_reviews: true,
    negative_threshold: 3,
  })
  const [replySettingsLoaded, setReplySettingsLoaded] = useState(false)
  const [savingReplySettings, setSavingReplySettings] = useState(false)
  const [replySettingsResult, setReplySettingsResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await getSupabaseBrowser().auth.getUser()
      if (data.user) setEmail(data.user.email ?? '')
    })()
  }, [])

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setReplySettings({
            auto_reply_enabled: data.auto_reply_enabled ?? false,
            auto_reply_delay_hours: data.auto_reply_delay_hours ?? 2,
            reply_persona: data.reply_persona ?? '',
            notify_negative_reviews: data.notify_negative_reviews ?? true,
            negative_threshold: data.negative_threshold ?? 3,
          })
        }
        setReplySettingsLoaded(true)
      })
      .catch(() => setReplySettingsLoaded(true))
  }, [])

  async function handleSaveReplySettings() {
    setSavingReplySettings(true)
    setReplySettingsResult(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replySettings),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setReplySettingsResult({ ok: true, msg: 'Settings saved.' })
    } catch (err) {
      setReplySettingsResult({ ok: false, msg: err instanceof Error ? err.message : 'Save failed.' })
    } finally {
      setSavingReplySettings(false)
    }
  }

  useEffect(() => {
    fetch('/api/restaurant')
      .then(r => r.json())
      .then(data => {
        if (data.googleConnected) setGoogleStatus('connected')
        else if (data.googleTokenOnly) {
          setGoogleStatus('token_only')
          loadLocations()
        } else setGoogleStatus('not_connected')
      })
      .catch(() => setGoogleStatus('not_connected'))
  }, [])

  async function loadLocations() {
    setLocationsLoading(true)
    try {
      const res = await fetch('/api/auth/google/locations')
      const data = await res.json()
      setLocations(data.locations ?? [])
    } catch {
      setLocations([])
    } finally {
      setLocationsLoading(false)
    }
  }

  async function handleSelectLocation(locationName: string) {
    setSavingLocation(true)
    try {
      const res = await fetch('/api/auth/google/set-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationName }),
      })
      if (res.ok) {
        setGoogleStatus('connected')
        setGoogleNotice('Google Business location linked successfully.')
        setGoogleNoticeType('success')
        setLocations(null)
      } else {
        const data = await res.json()
        setGoogleNotice(data.error ?? 'Failed to save location.')
        setGoogleNoticeType('error')
      }
    } catch {
      setGoogleNotice('Something went wrong. Please try again.')
      setGoogleNoticeType('error')
    } finally {
      setSavingLocation(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('google_success')
    const warning = params.get('google_warning')
    const oauthError = params.get('google_error')

    if (success) {
      if (warning === 'location_not_found') {
        setGoogleStatus('token_only')
        loadLocations()
      } else {
        setGoogleNotice('Google Business connected successfully.')
        setGoogleNoticeType('success')
        setGoogleStatus('connected')
      }
    } else if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'You cancelled the Google connection.',
        token_exchange_failed: 'Failed to connect Google. Please try again.',
        missing_tokens: 'Google did not return the required permissions.',
        state_mismatch: 'Connection failed due to a security check. Please try again.',
        restaurant_not_found: 'Could not find your restaurant. Please try again.',
        invalid_callback: 'Invalid callback. Please try again.',
      }
      setGoogleNotice(messages[oauthError] ?? 'Google connection failed. Please try again.')
      setGoogleNoticeType('error')
    }
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-reviews', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      const { newlyStored, repliesGenerated, autoMarkedReplied } = data
      setSyncResult(
        `Synced — ${newlyStored} new review${newlyStored !== 1 ? 's' : ''}, ` +
        `${repliesGenerated} draft${repliesGenerated !== 1 ? 's' : ''} generated, ` +
        `${autoMarkedReplied} auto-marked replied.`
      )
      router.refresh()
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : 'Sync failed. Try again.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <>
      <div className="sec-head">
        <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--t1)', marginBottom: 2 }}>Settings</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>Manage your account and integrations</p>
      </div>

      <div className="page-wrap" style={{ maxWidth: 680 }}>

        {/* Sync reviews */}
        <SectionCard
          title="Sync reviews"
          description="Manually fetch the latest reviews from Google and generate new reply drafts. Runs automatically every day."
          delay={0}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-press"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                borderRadius: 'var(--radius-m)', fontSize: 13, fontWeight: 500, color: 'var(--t1)',
                cursor: 'pointer', fontFamily: 'inherit', opacity: syncing ? 0.5 : 1,
              }}
            >
              {syncing ? (
                <>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" opacity=".25"/><path d="M12 2a10 10 0 010 20" opacity=".75"/>
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
                  </svg>
                  Sync now
                </>
              )}
            </button>
            {syncResult && (
              <p style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                {syncResult}
              </p>
            )}
          </div>
        </SectionCard>

        {/* Google Business */}
        <SectionCard title="Google Business" description="Connect your Google Business account to enable review syncing and direct replies." delay={40}>
          {googleNotice && (
            <div className={`banner ${googleNoticeType === 'success' ? 'banner-green' : 'banner-red'}`} style={{ marginBottom: 16 }}>
              {googleNotice}
            </div>
          )}

          {googleStatus === 'loading' && (
            <div className="skeleton" style={{ width: 96, height: 16, borderRadius: 6 }} />
          )}

          {googleStatus === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="dot dot-green pulse-dot" />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 1 }}>Connected</p>
                  <p style={{ fontSize: 12, color: 'var(--t3)' }}>Google Business Profile</p>
                </div>
              </div>
              <a href="/api/auth/google" style={{ fontSize: 13, color: 'var(--t3)', textDecoration: 'none' }}>
                Reconnect
              </a>
            </div>
          )}

          {googleStatus === 'token_only' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="dot dot-amber" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Select your location</span>
                </div>
                <a href="/api/auth/google" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none' }}>Reconnect</a>
              </div>
              <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12, lineHeight: 1.6 }}>
                Pick your business from the list below to finish linking your Google Business account.
              </p>

              {locationsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 12 }} />)}
                </div>
              )}

              {!locationsLoading && locations !== null && locations.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' }}>
                  No Google Business locations found.{' '}
                  <a href="/api/auth/google" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>Reconnect</a>
                </div>
              )}

              {!locationsLoading && locations && locations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {locations.map(loc => (
                    <button
                      key={loc.name}
                      onClick={() => handleSelectLocation(loc.name)}
                      disabled={savingLocation}
                      className="btn-press"
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 12,
                        border: '1px solid var(--border)', background: 'var(--surface-0)',
                        cursor: 'pointer', fontFamily: 'inherit', opacity: savingLocation ? 0.5 : 1,
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{loc.title}</p>
                      {loc.placeId && <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, fontFamily: 'monospace' }}>ID: {loc.placeId}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {googleStatus === 'not_connected' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 16, lineHeight: 1.6 }}>
                Link your Google Business profile to start syncing reviews and generating AI reply drafts.
              </p>
              <a
                href="/api/auth/google"
                className="btn-press"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px',
                  background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                  borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--t1)',
                  textDecoration: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Business
              </a>
            </div>
          )}
        </SectionCard>

        {/* Reply Settings */}
        <SectionCard
          title="Reply settings"
          description="Configure how Replova handles automatic replies and alerts."
          delay={60}
        >
          {!replySettingsLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 40, borderRadius: 8 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Auto-reply toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>Auto-reply to reviews</p>
                  <p style={{ fontSize: 12, color: 'var(--t3)' }}>Automatically post approved AI drafts after the delay period.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={replySettings.auto_reply_enabled}
                  onClick={() => setReplySettings(s => ({ ...s, auto_reply_enabled: !s.auto_reply_enabled }))}
                  className="toggle-track btn-press"
                  style={{ background: replySettings.auto_reply_enabled ? 'var(--ok)' : 'var(--border-md)' }}
                >
                  <span className="toggle-thumb" style={{ left: replySettings.auto_reply_enabled ? 21 : 3 }} />
                </button>
              </div>

              {/* Delay hours */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)' }}>
                  Delay before sending (hours)
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={replySettings.auto_reply_delay_hours}
                  onChange={e => setReplySettings(s => ({ ...s, auto_reply_delay_hours: Math.min(24, Math.max(1, Number(e.target.value))) }))}
                  className="field-input"
                  style={{ width: 100 }}
                />
              </div>

              {/* Reply persona */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)' }}>
                  Your reply voice / persona
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  value={replySettings.reply_persona}
                  onChange={e => setReplySettings(s => ({ ...s, reply_persona: e.target.value }))}
                  placeholder="Describe your restaurant's tone, e.g. 'We're casual and friendly. Use first names. Keep it brief and genuine.'"
                  className="field-input"
                  style={{ resize: 'vertical', lineHeight: 1.6 }}
                />
                <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'right' }}>{replySettings.reply_persona.length}/300</p>
              </div>

              {/* Negative review alerts toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>Alert me on low ratings</p>
                  <p style={{ fontSize: 12, color: 'var(--t3)' }}>Get an email when a review falls at or below the threshold.</p>
                </div>
                <button
                  role="switch"
                  aria-checked={replySettings.notify_negative_reviews}
                  onClick={() => setReplySettings(s => ({ ...s, notify_negative_reviews: !s.notify_negative_reviews }))}
                  className="toggle-track btn-press"
                  style={{ background: replySettings.notify_negative_reviews ? 'var(--ok)' : 'var(--border-md)' }}
                >
                  <span className="toggle-thumb" style={{ left: replySettings.notify_negative_reviews ? 21 : 3 }} />
                </button>
              </div>

              {/* Alert threshold */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)' }}>
                  Alert threshold (stars)
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setReplySettings(s => ({ ...s, negative_threshold: star }))}
                      className="btn-press"
                      style={{
                        width: 36, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: `1px solid ${replySettings.negative_threshold === star ? 'var(--t1)' : 'var(--border-md)'}`,
                        background: replySettings.negative_threshold === star ? 'var(--surface-2)' : 'var(--surface-0)',
                        color: replySettings.negative_threshold === star ? 'var(--t1)' : 'var(--t3)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {star}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--t3)' }}>Alert when rating is {replySettings.negative_threshold} star{replySettings.negative_threshold !== 1 ? 's' : ''} or below.</p>
              </div>

              {/* Save button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4 }}>
                <button
                  onClick={handleSaveReplySettings}
                  disabled={savingReplySettings}
                  className="btn-press"
                  style={{
                    padding: '9px 18px', background: 'var(--surface-2)', border: '1px solid var(--border-md)',
                    borderRadius: 'var(--radius-m)', fontSize: 13, fontWeight: 600, color: 'var(--t1)',
                    cursor: 'pointer', fontFamily: 'inherit', opacity: savingReplySettings ? 0.5 : 1,
                  }}
                >
                  {savingReplySettings ? 'Saving…' : 'Save settings'}
                </button>
                {replySettingsResult && (
                  <p style={{ fontSize: 12, fontWeight: 500, color: replySettingsResult.ok ? 'var(--ok)' : 'var(--err)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {replySettingsResult.ok
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      : null}
                    {replySettingsResult.msg}
                  </p>
                )}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Account */}
        <SectionCard title="Account" delay={80}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t3)' }}>
              Email address
            </label>
            <div style={{
              width: '100%', background: 'var(--surface-0)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius-m)', padding: '10px 14px', fontSize: 13,
              color: 'var(--t3)', userSelect: 'none', cursor: 'default',
            }}>
              {email || '—'}
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)' }}>Your email cannot be changed.</p>
          </div>
        </SectionCard>

        {/* Danger zone */}
        <SectionCard title="Danger zone" delay={120}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>Delete account</p>
              <p style={{ fontSize: 12, color: 'var(--t3)' }}>Permanently delete your account and all associated data. This cannot be undone.</p>
            </div>
            <DeleteAccountButton />
          </div>
        </SectionCard>

      </div>
    </>
  )
}

function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Deletion failed')
      }
      await getSupabaseBrowser().auth.signOut()
      window.location.href = '/'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setDeleting(false)
    }
  }

  if (confirming) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        {error && <p style={{ fontSize: 12, color: 'var(--err)' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { setConfirming(false); setError(null) }}
            disabled={deleting}
            className="btn-press"
            style={{
              padding: '7px 14px', background: 'none', border: '1px solid var(--border-md)',
              borderRadius: 9, fontSize: 12, fontWeight: 600, color: 'var(--t2)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-press"
            style={{
              display: 'inline-flex', alignItems: 'center', padding: '7px 14px',
              background: 'var(--err-sub)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 9, fontSize: 12, fontWeight: 600, color: 'var(--err)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {deleting ? 'Deleting…' : 'Yes, delete everything'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      className="btn-press"
      onClick={() => setConfirming(true)}
      style={{
        display: 'inline-flex', alignItems: 'center', padding: '7px 14px',
        background: 'var(--err-sub)', border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 9, fontSize: 12, fontWeight: 600, color: 'var(--err)',
        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
      }}
    >
      Delete account
    </button>
  )
}
