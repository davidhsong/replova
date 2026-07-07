'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'
import { IconLock, IconSignOut, IconRefresh } from '@/components/icons'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }

function SectionHeader({ kicker, title, sub, action }: {
  kicker?: string; title: string; sub?: string; action?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
      <div>
        {kicker && <div className="t-eyebrow" style={{ marginBottom: 6 }}>{kicker}</div>}
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)', marginBottom: sub ? 2 : 0 }}>{title}</h2>
        {sub && <div className="t-xs c-t3">{sub}</div>}
      </div>
      {action}
    </div>
  )
}

function Row({ label, hint, children, locked = false }: {
  label: string; hint?: string; children: React.ReactNode; locked?: boolean
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: locked ? 'var(--t3)' : 'var(--t1)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {locked && <IconLock s={12} />}
          {label}
        </div>
        {hint && <div className="t-xs c-t3" style={{ marginTop: 4, lineHeight: 1.5, maxWidth: 200 }}>{hint}</div>}
      </div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, disabled = false }: {
  on: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        width: 36, height: 20, borderRadius: 'var(--r-pill)',
        background: on ? 'var(--accent)' : 'var(--surface-3)',
        position: 'relative', flexShrink: 0, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s', opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transition: 'left 0.15s',
      }} />
    </button>
  )
}

function LockedNotice({ children, plan = 'Practice' }: { children: React.ReactNode; plan?: string }) {
  return (
    <div style={{ position: 'relative', padding: 14, background: 'var(--surface-2)', border: '1px dashed var(--line-md)', borderRadius: 'var(--r-4)' }}>
      <div style={{ opacity: 0.4, pointerEvents: 'none' }}>{children}</div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span className="pill pill-accent" style={{ height: 22 }}>
          <IconLock s={10} /> {plan} plan
        </span>
        <a href="/dashboard/billing" style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', textDecoration: 'underline' }}>
          Upgrade →
        </a>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState<string>('starter')

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
  const [savedPersona, setSavedPersona] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  const [businessType, setBusinessType] = useState('')
  const [savingCuisine, setSavingCuisine] = useState(false)
  const [businessTypeResult, setBusinessTypeResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const [reportLogoUrl, setReportLogoUrl] = useState('')
  const [savingLogo, setSavingLogo] = useState(false)
  const [logoResult, setLogoResult] = useState<{ ok: boolean; msg: string } | null>(null)

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
          const persona = data.reply_persona ?? ''
          setReplySettings({
            auto_reply_enabled: data.auto_reply_enabled ?? false,
            auto_reply_delay_hours: data.auto_reply_delay_hours ?? 2,
            reply_persona: persona,
            notify_negative_reviews: data.notify_negative_reviews ?? true,
            negative_threshold: data.negative_threshold ?? 3,
          })
          setSavedPersona(persona)
          setBusinessType(data.cuisine_type ?? '')
          setReportLogoUrl(data.report_logo_url ?? '')
        }
        setReplySettingsLoaded(true)
      })
      .catch(() => setReplySettingsLoaded(true))
  }, [])

  useEffect(() => {
    fetch('/api/restaurant')
      .then(r => r.json())
      .then(data => {
        if (data.plan) setPlan(data.plan)
        if (data.googleConnected) setGoogleStatus('connected')
        else if (data.googleTokenOnly) {
          setGoogleStatus('token_only')
          loadLocations()
        } else setGoogleStatus('not_connected')
      })
      .catch(() => setGoogleStatus('not_connected'))
  }, [])

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
        restaurant_not_found: 'Could not find your business. Please try again.',
        invalid_callback: 'Invalid callback. Please try again.',
      }
      setGoogleNotice(messages[oauthError] ?? 'Google connection failed. Please try again.')
      setGoogleNoticeType('error')
    }
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

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/sync-reviews', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      const { newlyStored, repliesGenerated, autoMarkedReplied } = data
      setSyncResult(
        `Synced: ${newlyStored} new review${newlyStored !== 1 ? 's' : ''}, ` +
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

  async function handleSaveCuisine() {
    setSavingCuisine(true)
    setBusinessTypeResult(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuisine_type: businessType || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setBusinessTypeResult({ ok: true, msg: 'Saved.' })
    } catch (err) {
      setBusinessTypeResult({ ok: false, msg: err instanceof Error ? err.message : 'Save failed.' })
    } finally {
      setSavingCuisine(false)
    }
  }

  async function handleSaveReplySettings() {
    setSavingReplySettings(true)
    setReplySettingsResult(null)
    const personaChanged = plan === 'agency' && replySettings.reply_persona !== savedPersona
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
      setSavedPersona(replySettings.reply_persona)

      if (personaChanged) {
        setSavingReplySettings(false)
        setRegenerating(true)
        setReplySettingsResult({ ok: true, msg: 'Settings saved. Regenerating drafts…' })
        try {
          const regen = await fetch('/api/replies/regenerate-all', { method: 'POST' })
          const regenData = await regen.json()
          if (!regen.ok) throw new Error(regenData.error ?? 'Regeneration failed')
          setReplySettingsResult({ ok: true, msg: `Done. ${regenData.regenerated} draft${regenData.regenerated !== 1 ? 's' : ''} rewritten with new voice.` })
          router.refresh()
        } catch (regenErr) {
          setReplySettingsResult({ ok: false, msg: regenErr instanceof Error ? regenErr.message : 'Drafts failed to regenerate.' })
        } finally {
          setRegenerating(false)
        }
      } else {
        setReplySettingsResult({ ok: true, msg: 'Settings saved.' })
      }
    } catch (err) {
      setReplySettingsResult({ ok: false, msg: err instanceof Error ? err.message : 'Save failed.' })
      setSavingReplySettings(false)
    } finally {
      if (!personaChanged) setSavingReplySettings(false)
    }
  }

  async function handleSaveLogo() {
    setSavingLogo(true)
    setLogoResult(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_logo_url: reportLogoUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Save failed')
      }
      setLogoResult({ ok: true, msg: 'Logo URL saved.' })
    } catch (err) {
      setLogoResult({ ok: false, msg: err instanceof Error ? err.message : 'Save failed.' })
    } finally {
      setSavingLogo(false)
    }
  }

  return (
    <>
      <div className="page-header" style={{ maxWidth: 880 }}>
        <div className="t-eyebrow" style={{ marginBottom: 6 }}>
          <span style={{ color: 'var(--t3)' }}>Workspace</span>
          {' › '}
          <span>Settings</span>
        </div>
        <h1 className="t-h1" style={{ marginBottom: 4 }}>Settings</h1>
        <p className="t-sm c-t3">Manage your integrations and reply preferences</p>
      </div>

      <div className="page-body" style={{ maxWidth: 880 }}>

        {/* Sync */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader
            kicker="Sync"
            title="Reviews"
            sub="Replova auto-syncs every 6 hours."
            action={
              <button onClick={handleSync} disabled={syncing} className="btn btn-ghost btn-sm">
                <span className={syncing ? 'spin' : undefined} style={{ display: 'inline-flex' }}>
                  <IconRefresh s={12} />
                </span>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            }
          />
          {syncResult && (
            <div className="banner banner-pos fade-in" style={{ marginTop: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              {syncResult}
            </div>
          )}
        </section>

        {/* Google Business */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader kicker="Integration" title="Google Business" />

          {googleNotice && (
            <div className={`banner ${googleNoticeType === 'success' ? 'banner-pos' : 'banner-neg'} fade-in`} style={{ marginBottom: 16 }}>
              {googleNotice}
            </div>
          )}

          {googleStatus === 'loading' && (
            <div className="skeleton" style={{ width: 120, height: 16, borderRadius: 6 }} />
          )}

          {googleStatus === 'connected' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--r-4)', background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 48 48">
                    <path fill="#4285f4" d="M43.6 20.5H24v8h11.3c-1.6 4.6-6 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 3l5.7-5.7C33.6 6.5 29 4.5 24 4.5a19.5 19.5 0 1 0 0 39c10.7 0 19.5-7.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Google Business Profile
<span className="t-xs c-pos">Connected</span>
                  </div>
                  <div className="t-xs c-t3">Scope: read reviews, post replies</div>
                </div>
              </div>
              <a href="/api/auth/google" className="btn btn-ghost btn-sm">Reconnect</a>
            </div>
          )}

          {googleStatus === 'token_only' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className="dot dot-warn" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Select your business location</span>
                <a href="/api/auth/google" className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto' }}>Reconnect</a>
              </div>
              <p className="t-xs c-t3" style={{ marginBottom: 12, lineHeight: 1.6 }}>
                Pick your business from the list below to finish linking your Google Business account.
              </p>

              {locationsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 'var(--r-4)' }} />)}
                </div>
              )}

              {!locationsLoading && locations !== null && locations.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--t2)', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-4)', padding: '12px 16px' }}>
                  No Google Business locations found.{' '}
                  <a href="/api/auth/google" style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline' }}>Reconnect</a>
                </div>
              )}

              {!locationsLoading && locations && locations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {locations.map(loc => (
                    <button
                      key={loc.name}
                      onClick={() => handleSelectLocation(loc.name)}
                      disabled={savingLocation}
                      style={{
                        width: '100%', textAlign: 'left', padding: '12px 16px',
                        borderRadius: 'var(--r-4)', border: '1px solid var(--line)',
                        background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
                        opacity: savingLocation ? 0.5 : 1, transition: 'border-color 0.1s',
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{loc.title}</p>
                      {loc.placeId && <p className="t-mono t-xs c-t4" style={{ marginTop: 2 }}>ID: {loc.placeId}</p>}
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
              <a href="/api/auth/google" className="btn btn-ghost">
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Connect Google Business
              </a>
            </div>
          )}
        </section>

        {/* Business profile */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader
            kicker="Business"
            title="Profile"
            sub="Helps auto-discover competitors in your category. Choose the type that best describes your business."
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label className="t-eyebrow" style={{ display: 'block', marginBottom: 4 }} htmlFor="businessType">
              Business Type
            </label>
            <select
              id="businessType"
              className="field"
              value={businessType}
              onChange={e => setBusinessType(e.target.value)}
            >
              <option value="">Select type</option>
              <option value="medical_spa">Med Spa / Aesthetic Clinic</option>
              <option value="botox_clinic">Botox & Filler Clinic</option>
              <option value="laser_clinic">Laser & Skin Treatment Clinic</option>
              <option value="beauty_salon">Beauty Salon / Hair Salon</option>
              <option value="nail_salon">Nail Salon</option>
              <option value="massage_therapy">Massage Therapy Studio</option>
              <option value="dental_office">Dental Office</option>
              <option value="chiropractor">Chiropractic Office</option>
              <option value="physical_therapy">Physical Therapy Clinic</option>
              <option value="wellness_center">Wellness / Holistic Health Center</option>
            </select>
            <div style={{ marginTop: 4 }}>
              <button onClick={handleSaveCuisine} disabled={savingCuisine} className="btn btn-primary btn-sm">
                {savingCuisine ? 'Saving…' : 'Save'}
              </button>
            </div>
            {businessTypeResult && (
              <span style={{ fontSize: 12, fontWeight: 500, color: businessTypeResult.ok ? 'var(--pos)' : 'var(--neg)' }}>
                {businessTypeResult.msg}
              </span>
            )}
          </div>
        </section>

        {/* Reply settings */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader kicker="AI" title="Reply settings" />

          {!replySettingsLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 32, padding: '18px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="skeleton" style={{ height: 14, borderRadius: 4, width: 120 }} />
                  <div className="skeleton" style={{ height: 32, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Row label="Auto-reply to reviews" hint="Skip the queue for 4★ and 5★ when sentiment is positive.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Toggle
                    on={replySettings.auto_reply_enabled}
                    onChange={v => setReplySettings(s => ({ ...s, auto_reply_enabled: v }))}
                  />
                  <span className="t-sm c-t2">
                    {replySettings.auto_reply_enabled ? 'On: positive reviews send automatically' : 'Off: every reply needs your approval'}
                  </span>
                </div>
              </Row>

              <Row label="Delay before sending" hint="Helps avoid the bot-replied-instantly look.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="range" min={1} max={24}
                    value={replySettings.auto_reply_delay_hours}
                    onChange={e => setReplySettings(s => ({ ...s, auto_reply_delay_hours: +e.target.value }))}
                    style={{ flex: 1, maxWidth: 240, accentColor: 'var(--accent)' }}
                  />
                  <span className="t-mono tnum" style={{ fontSize: 13, minWidth: 56 }}>
                    {replySettings.auto_reply_delay_hours} hour{replySettings.auto_reply_delay_hours > 1 ? 's' : ''}
                  </span>
                </div>
              </Row>

              <Row label="Reply voice / persona" hint="Shapes every draft we generate." locked={plan !== 'agency'}>
                {plan !== 'agency' ? (
                  <LockedNotice>
                    <textarea className="field" rows={3} readOnly style={{ background: 'var(--surface)', resize: 'none' }} defaultValue="" />
                  </LockedNotice>
                ) : (
                  <>
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={replySettings.reply_persona}
                      onChange={e => setReplySettings(s => ({ ...s, reply_persona: e.target.value }))}
                      placeholder="Describe your practice's tone, e.g. 'Warm and clinical. Board-certified team. Use first names. Never be defensive about results.'"
                      className="field"
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                    <p className="t-xs c-t3" style={{ textAlign: 'right', marginTop: 4 }}>{replySettings.reply_persona.length}/300</p>
                  </>
                )}
              </Row>

              <Row label="Alert me on low ratings" hint="Get an email the moment a low-star review arrives.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Toggle
                    on={replySettings.notify_negative_reviews}
                    onChange={v => setReplySettings(s => ({ ...s, notify_negative_reviews: v }))}
                  />
                  <span className="t-sm c-t2">{replySettings.notify_negative_reviews ? 'On' : 'Off'}</span>
                </div>
              </Row>

              <Row label="Alert threshold" hint="At or below this rating triggers an alert.">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setReplySettings(s => ({ ...s, negative_threshold: star }))}
                      style={{
                        width: 32, height: 32, borderRadius: 'var(--r-3)', fontSize: 16,
                        border: `1px solid ${star <= replySettings.negative_threshold ? 'var(--line-md)' : 'var(--line)'}`,
                        background: 'none', cursor: 'pointer',
                        color: star <= replySettings.negative_threshold ? 'var(--gold)' : 'var(--line-hi)',
                      }}
                    >
                      ★
                    </button>
                  ))}
                  <span className="t-xs c-t3" style={{ marginLeft: 8 }}>≤ {replySettings.negative_threshold} star{replySettings.negative_threshold !== 1 ? 's' : ''}</span>
                </div>
              </Row>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
                {replySettingsResult && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: replySettingsResult.ok ? 'var(--pos)' : 'var(--neg)' }}>
                    {replySettingsResult.msg}
                  </span>
                )}
                <button onClick={handleSaveReplySettings} disabled={savingReplySettings || regenerating} className="btn btn-primary btn-sm">
                  {regenerating ? 'Rewriting drafts…' : savingReplySettings ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </>
          )}
        </section>

        {/* Report branding */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader kicker="Reports" title="Report branding" />
          <Row label="Logo URL" hint="Used on white-labeled monthly PDF reports." locked={plan !== 'agency'}>
            {plan !== 'agency' ? (
              <LockedNotice>
                <input className="field" placeholder="https://example.com/logo.png" readOnly />
              </LockedNotice>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="url"
                  value={reportLogoUrl}
                  onChange={e => setReportLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="field"
                />
                <p className="t-xs c-t3">Must be a publicly accessible image URL (PNG, JPG, SVG).</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={handleSaveLogo} disabled={savingLogo} className="btn btn-primary btn-sm">
                    {savingLogo ? 'Saving…' : 'Save logo URL'}
                  </button>
                  {logoResult && (
                    <span style={{ fontSize: 12, fontWeight: 500, color: logoResult.ok ? 'var(--pos)' : 'var(--neg)' }}>
                      {logoResult.msg}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Row>
        </section>

        {/* Account */}
        <section style={{ marginBottom: 52 }}>
          <SectionHeader kicker="Account" title="You" />
          <Row label="Email" hint="Magic-link sign-in only.">
            <input
              className="field"
              value={email || '-'}
              readOnly
              style={{ background: 'var(--surface-2)', cursor: 'not-allowed', color: 'var(--t3)' }}
            />
          </Row>
          <Row label="Sign out">
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                await getSupabaseBrowser().auth.signOut()
                window.location.href = '/signin'
              }}
            >
              <IconSignOut s={13} />
              Sign out
            </button>
          </Row>
        </section>

        {/* Danger zone */}
        <section>
          <SectionHeader
            kicker="Danger zone"
            title="Delete account"
            sub="Permanently deletes your account, reviews, replies, and billing. Cannot be undone."
          />
          <DeleteAccountButton />
        </section>

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
      <div className="fade-in" style={{ padding: 18, background: 'var(--neg-sub)', border: '1px solid var(--neg-line)', borderRadius: 'var(--r-4)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--neg)', marginBottom: 6 }}>This cannot be undone.</div>
        <p className="t-xs c-t2" style={{ marginBottom: 14, maxWidth: 520, lineHeight: 1.6 }}>
          We&apos;ll cancel your subscription and delete your account and all associated reviews. You&apos;ll be signed out immediately.
        </p>
        {error && <p style={{ fontSize: 12, color: 'var(--neg)', marginBottom: 10 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { setConfirming(false); setError(null) }}
            disabled={deleting}
            className="btn btn-ghost btn-sm"
          >
            Keep account
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-danger btn-sm"
          >
            {deleting ? 'Deleting…' : 'Yes, delete everything'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)} className="btn btn-danger btn-sm">
      Delete account
    </button>
  )
}
