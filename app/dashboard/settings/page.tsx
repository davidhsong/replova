'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase'

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
