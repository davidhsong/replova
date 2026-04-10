'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
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
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Check your inbox</h1>
          <p className="text-zinc-500 text-sm leading-relaxed">
            We sent a sign-in link to <span className="text-zinc-900 font-medium">{email}</span>.<br />
            Click it to access your dashboard.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold tracking-tight text-zinc-900">
            Replova
          </a>
          <a
            href="/onboard"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            Start free trial
          </a>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-zinc-900 mb-1.5">Sign in to Replova</h1>
            <p className="text-zinc-500 text-sm">
              We&apos;ll send a magic link to your email — no password needed.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-xs font-medium text-zinc-500 uppercase tracking-wide"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-shadow"
                placeholder="you@restaurant.com"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-full bg-zinc-900 text-white text-sm font-medium py-3 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-400">
            New to Replova?{' '}
            <a
              href="/onboard"
              className="text-zinc-900 font-medium hover:underline"
            >
              Start your free trial
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-5 px-6">
        <p className="text-center text-sm text-zinc-400">
          © {new Date().getFullYear()} Replova. All rights reserved.
        </p>
      </footer>
    </div>
  )
}
