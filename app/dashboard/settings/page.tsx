'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'

type GoogleStatus = 'loading' | 'not_connected' | 'token_only' | 'connected'
type GmbLocation = { name: string; title: string; placeId: string | null }

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
  const [locations, setLocations] = useState<GmbLocation[] | null>(null)
  const [locationsLoading, setLocationsLoading] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)

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
        setGoogleNotice('Google Business location linked successfully!')
        setLocations(null)
      } else {
        const data = await res.json()
        setGoogleNotice(data.error ?? 'Failed to save location.')
      }
    } catch {
      setGoogleNotice('Something went wrong. Please try again.')
    } finally {
      setSavingLocation(false)
    }
  }

  // Handle redirect-back notices from OAuth flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('google_success')
    const warning = params.get('google_warning')
    const oauthError = params.get('google_error')

    if (success) {
      if (warning === 'location_not_found') {
        // Don't show a scary warning — just silently enter token_only state
        // so the location picker loads below
        setGoogleStatus('token_only')
        loadLocations()
      } else {
        setGoogleNotice('Google Business connected successfully!')
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
    }
  }, [])

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
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage your profile and account</p>
      </div>

      <div className="space-y-5">

        {/* Avatar */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Profile picture</h2>
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
                  className="w-16 h-16 rounded-full object-cover ring-1 ring-zinc-700"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-xl font-medium text-zinc-300">
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
                className="text-sm text-zinc-300 hover:text-zinc-100 transition-colors disabled:opacity-40"
              >
                {uploadingAvatar ? 'Uploading…' : 'Change photo'}
              </button>
              <p className="text-xs text-zinc-600 mt-0.5">JPG, PNG or GIF · Max 2 MB</p>
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

        {/* Google Business connection */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-1">Google Business</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Connect your Google Business account to post review replies directly — no copy-paste.
          </p>

          {googleNotice && (
            <div className={`mb-4 text-sm rounded-lg px-4 py-3 border ${
              googleStatus === 'connected'
                ? 'bg-emerald-950/60 border-emerald-900 text-emerald-300'
                : 'bg-amber-950/60 border-amber-900 text-amber-300'
            }`}>
              {googleNotice}
            </div>
          )}

          {googleStatus === 'loading' && (
            <p className="text-sm text-zinc-600">Checking connection…</p>
          )}

          {googleStatus === 'connected' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-sm text-zinc-300">Connected</span>
              </div>
              <a
                href="/api/auth/google"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Reconnect
              </a>
            </div>
          )}

          {googleStatus === 'token_only' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-sm text-zinc-300">Select your restaurant location</span>
                </div>
                <a
                  href="/api/auth/google"
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Reconnect
                </a>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                We couldn&apos;t automatically identify your restaurant from the connected Google account.
                Pick it from the list below to finish linking.
              </p>

              {locationsLoading && (
                <p className="text-sm text-zinc-600">Loading your locations…</p>
              )}

              {!locationsLoading && locations !== null && locations.length === 0 && (
                <div className="text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
                  No Google Business locations found on this account.
                  Make sure you signed in with the Google account that manages this restaurant on Google Maps, then{' '}
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
                      className="w-full text-left px-4 py-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <p className="text-sm font-medium text-zinc-100">{loc.title}</p>
                      {loc.placeId && (
                        <p className="text-xs text-zinc-600 mt-0.5">Place ID: {loc.placeId}</p>
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
              className="inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-white transition-colors"
            >
              Connect Google Business
            </a>
          )}
        </div>

        {/* Personal info */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Personal information</h2>
          <form onSubmit={handleSave} className="space-y-4">

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                Email address
              </label>
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-500 select-none">
                {email || '—'}
              </div>
              <p className="text-xs text-zinc-600">Your email cannot be changed.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="displayName"
                className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="phone"
                className="text-xs font-medium text-zinc-400 uppercase tracking-wide"
              >
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving…' : 'Save changes'}
              </button>
              {saved && (
                <span className="text-sm text-emerald-400">Saved!</span>
              )}
            </div>
          </form>
        </div>

      </div>
    </div>
  )
}
