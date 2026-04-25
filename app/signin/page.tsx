'use client'

import { useState } from 'react'

type State = 'idle' | 'loading' | 'sent'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError(null)

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/auth/callback`,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      setState('idle')
    } else {
      setState('sent')
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-950 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-base font-semibold tracking-tight text-zinc-100">
            Replova
          </a>
          <a
            href="/onboard"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Start free trial
          </a>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm fade-up">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-zinc-500 text-sm">
              Enter your email to sign in to your dashboard.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-8">
            {state === 'sent' ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-zinc-200 font-medium">Check your email</p>
                <p className="text-sm text-zinc-500">We sent a sign-in link to <span className="text-zinc-300">{email}</span>.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-3">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === 'loading' || !email.trim()}
                  className="btn-press mt-1 rounded-full bg-zinc-100 text-zinc-900 text-sm font-semibold py-3 hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {state === 'loading' ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Signing in…
                    </>
                  ) : (
                    'Sign in'
                  )}
                </button>

                <p className="text-center text-sm text-zinc-600">
                  No account?{' '}
                  <a href="/onboard" className="text-zinc-400 hover:text-zinc-200 transition-colors font-medium">
                    Start your free trial
                  </a>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t border-zinc-800 py-5 px-6">
        <p className="text-center text-xs text-zinc-700">
          © {new Date().getFullYear()} Replova
        </p>
      </footer>
    </div>
  )
}
