'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

export default function OnboardPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [placeId, setPlaceId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, placeId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create restaurant.')

      const { error: otpError } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (otpError) throw new Error(otpError.message)

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-zinc-900 mb-3">You're in.</h1>
          <p className="text-zinc-500">
            Check your email. Click the sign-in link to access your dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="mb-8">
          <a href="/" className="text-lg font-semibold text-zinc-900">Replova</a>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Start your free trial</h1>
        <p className="text-zinc-500 mb-8">30 days free. No credit card required.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-900" htmlFor="name">
              Restaurant name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="Bella Napoli"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-900" htmlFor="email">
              Your email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="you@restaurant.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-zinc-900" htmlFor="placeId">
              Google Place ID
            </label>
            <input
              id="placeId"
              type="text"
              required
              value={placeId}
              onChange={e => setPlaceId(e.target.value)}
              className="border border-zinc-200 rounded-lg px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
              placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            />
            <p className="text-xs text-zinc-400 leading-relaxed">
              Find your Place ID at:{' '}
              <a
                href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-zinc-500"
              >
                Google Place ID Finder
              </a>
              <br />
              Search for your restaurant and copy the Place ID shown.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-900 text-white text-sm font-medium py-3 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up…' : 'Start free trial'}
          </button>
        </form>
      </div>
    </div>
  )
}
