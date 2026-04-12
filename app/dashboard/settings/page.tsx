'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }

function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30">
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {description && <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>('loading')
  const [googleNotice, setGoogleNotice] = useState<string | null>(null)
  const [googleNoticeType, setGoogleNoticeType] = useState<'success' | 'error'>('success')
  const [locations, setLocations] = useState<GmbLocation[] | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    supabaseBrowser.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? '')
        setDisplayName((user.user_metadata?.display_name as string | undefined) ?? '')
        setPhoneNumber((user.user_metadata?.phone_number as string | undefined) ?? '')
        setAvatarUrl((user.user_metadata?.avatar_url as string | undefined) ?? null)
      }
    })
  }, [])

  useEffect(() => {
    fetch('/api/restaurant')
      .then(r => r.json())
      .then(data => {
        if (data.googleConnected) setGoogleStatus('connected')
        else if (data.googleTokenOnly) {
          setGoogleStatus('token_only')
          loadLocations()
        }
        else setGoogleStatus('not_connected')
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
        missing_tokens: 'Google did not return the required permissions. Make sure to grant all requested access.',
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, phone_number: phoneNumber }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to save')
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Upload failed')
      }

      const { url } = await res.json()
      setAvatarUrl(url)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const initials = (displayName || email)
    .split(/[\s@]/)
    .filter(Boolean)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?'

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 fade-up">
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Settings</h1>
        <p className="text-zinc-600 text-sm mt-0.5">Manage your profile and account</p>
      </div>

      <div className="space-y-4">

        {/* Avatar */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-200 mb-5">Profile picture</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="relative group shrink-0"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-zinc-800"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-semibold text-zinc-400 ring-2 ring-zinc-700">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {uploadingAvatar ? '…' : 'Edit'}
                </span>
              </div>
            </button>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="text-sm text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-40 font-medium"
              >
                {uploadingAvatar ? 'Uploading…' : 'Change photo'}
              </button>
              <p className="text-xs text-zinc-700 mt-0.5">JPG, PNG or GIF · Max 2 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* Sync reviews */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30" style={{ animationDelay: '40ms' }}>
          <h2 className="text-sm font-semibold text-zinc-200 mb-1">Sync reviews</h2>
          <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
            Manually fetch the latest reviews from Google and generate new reply drafts. This runs automatically every Monday.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-press inline-flex items-center gap-2 bg-zinc-800 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700"
            >
              {syncing ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Syncing…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sync now
                </>
              )}
            </button>
            {syncResult && (
              <p className="text-xs text-zinc-400">{syncResult}</p>
            )}
          </div>
        </div>

        {/* Google Business */}
        <SectionCard
          title="Google Business"
          description="Connect your Google Business account to enable review syncing."
        >
          {googleNotice && (
            <div className={`mb-4 text-sm rounded-xl px-4 py-3 border ${
              googleNoticeType === 'success'
                ? 'bg-emerald-950/60 border-emerald-900/60 text-emerald-300'
                : 'bg-red-950/60 border-red-900/60 text-red-300'
            }`}>
              {googleNotice}
            </div>
          )}

          {googleStatus === 'loading' && (
            <div className="flex items-center gap-2">
              <div className="skeleton w-24 h-4 rounded" />
            </div>
          )}

          {googleStatus === 'connected' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot shrink-0" />
                <span className="text-sm text-zinc-300 font-medium">Connected</span>
              </div>
              <a
                href="/api/auth/google"
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                Reconnect
              </a>
            </div>
          )}

          {googleStatus === 'token_only' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-sm text-zinc-300 font-medium">Select your location</span>
                </div>
                <a href="/api/auth/google" className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
                  Reconnect
                </a>
              </div>
              <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
                Pick your restaurant from the list below to finish linking your Google Business account.
              </p>

              {locationsLoading && (
                <div className="space-y-2">
                  {[0, 1].map(i => (
                    <div key={i} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
              )}

              {!locationsLoading && locations !== null && locations.length === 0 && (
                <div className="text-sm text-zinc-500 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3">
                  No Google Business locations found on this account.
                  Make sure you signed in with the correct Google account, then{' '}
                  <a href="/api/auth/google" className="text-zinc-300 underline underline-offset-2">reconnect</a>.
                </div>
              )}

              {!locationsLoading && locations && locations.length > 0 && (
                <div className="space-y-1.5">
                  {locations.map(loc => (
                    <button
                      key={loc.name}
                      onClick={() => handleSelectLocation(loc.name)}
                      disabled={savingLocation}
                      className="w-full text-left px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-950/50 hover:border-zinc-600 hover:bg-zinc-800/50 transition-colors disabled:opacity-50 btn-press"
                    >
                      <p className="text-sm font-medium text-zinc-100">{loc.title}</p>
                      {loc.placeId && (
                        <p className="text-xs text-zinc-600 mt-0.5 font-mono">ID: {loc.placeId}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {googleStatus === 'not_connected' && (
            <a
              href="/api/auth/google"
              className="btn-press inline-flex items-center gap-2 bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect Google Business
            </a>
          )}
        </SectionCard>

        {/* Personal info */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-200 mb-5">Personal information</h2>
          <form onSubmit={handleSave} className="space-y-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Email address
              </label>
              <div className="bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-4 py-3 text-sm text-zinc-600 select-none">
                {email || '—'}
              </div>
              <p className="text-xs text-zinc-700">Your email cannot be changed.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="displayName"
                className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="phone"
                className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
              >
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="btn-press bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving…' : 'Save changes'}
              </button>
              {saved && (
                <span className="text-sm text-emerald-400 font-medium">Saved</span>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
