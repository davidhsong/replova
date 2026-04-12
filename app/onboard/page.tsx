'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase'

type Step = 'search' | 'confirm' | 'email' | 'success'

interface PlaceResult {
  placeId: string
  name: string
  address: string
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['search', 'confirm', 'email', 'success']
  const labels = ['Find your business', 'Confirm', 'Your email', 'Done']
  const idx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.slice(0, 3).map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
            i < idx
              ? 'bg-blue-600 text-white'
              : i === idx
              ? 'bg-zinc-900 text-white'
              : 'bg-zinc-800 text-zinc-600'
          }`}>
            {i < idx ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          <span className={`ml-2 text-xs font-medium mr-4 ${i === idx ? 'text-zinc-100' : 'text-zinc-600'}`}>
            {labels[i]}
          </span>
          {i < 2 && <div className={`w-6 h-px mr-4 ${i < idx ? 'bg-blue-600' : 'bg-zinc-800'}`} />}
        </div>
      ))}
    </div>
  )
}

export default function OnboardPage() {
  const [step, setStep] = useState<Step>('search')

  // Step 1: search
  const [restaurantName, setRestaurantName] = useState('')
  const [city, setCity] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [result, setResult] = useState<PlaceResult | null>(null)

  // Step 3: email
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearching(true)
    setSearchError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({ name: restaurantName.trim(), city: city.trim() })
      const res = await fetch(`/api/onboard/search-place?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Search failed')

      if (!data.found) {
        setSearchError(`We couldn't find "${restaurantName}" in ${city}. Try a different spelling or city.`)
        return
      }

      setResult({ placeId: data.placeId, name: data.name, address: data.address })
      setStep('confirm')
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }

  async function handleConfirm() {
    setStep('email')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!result) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.name,
          email,
          placeId: result.placeId,
          redirectTo: `${window.location.origin}/dashboard?success=1`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create account.')

      if (data.magicLink) {
        // Sign the user in directly — no email needed
        window.location.href = data.magicLink
        return
      }

      // Fallback: magic link generation failed, send OTP email the normal way
      const { error: otpError } = await supabaseBrowser.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (otpError) throw new Error(otpError.message)

      setSuccessEmail(email)
      setStep('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="min-h-dvh bg-zinc-950 flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center fade-up">
          <div className="w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-900 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">You&apos;re all set</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            We sent a sign-in link to{' '}
            <span className="text-zinc-200 font-medium">{successEmail}</span>.{' '}
            Click it to access your dashboard.
          </p>
          <p className="text-zinc-600 text-xs mt-4">
            You&apos;ll receive suggested replies as new reviews come in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-zinc-950 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-base font-semibold text-zinc-100 tracking-tight">
            Replova
          </a>
          <a href="/signin" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            Sign in
          </a>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md fade-up">

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight mb-1">
              {step === 'search' && 'Start your free trial'}
              {step === 'confirm' && 'Is this your business?'}
              {step === 'email' && 'Where should we send the replies?'}
            </h1>
            <p className="text-zinc-500 text-sm">
              {step === 'search' && '30 days free. No credit card required.'}
              {step === 'confirm' && 'Verify we found the right listing.'}
              {step === 'email' && "We'll send you AI suggested replies whenever new reviews come in."}
            </p>
          </div>

          <StepIndicator current={step} />

          {/* Step 1: Search */}
          {step === 'search' && (
            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" htmlFor="rname">
                  Business name
                </label>
                <input
                  id="rname"
                  type="text"
                  required
                  value={restaurantName}
                  onChange={e => setRestaurantName(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Bella Napoli"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  type="text"
                  required
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="New York"
                />
              </div>

              {searchError && (
                <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-3">
                  {searchError}
                </div>
              )}

              <button
                type="submit"
                disabled={searching || !restaurantName.trim() || !city.trim()}
                className="btn-press mt-1 bg-zinc-100 text-zinc-900 text-sm font-semibold py-3 rounded-full hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {searching ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Searching…
                  </>
                ) : (
                  'Find my business'
                )}
              </button>
            </form>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && result && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{result.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{result.address}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="btn-press bg-zinc-100 text-zinc-900 text-sm font-semibold py-3 rounded-full hover:bg-white transition-colors"
              >
                Yes, this is my business
              </button>
              <button
                onClick={() => { setStep('search'); setResult(null); setSearchError(null) }}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1"
              >
                That&apos;s not it — search again
              </button>
            </div>
          )}

          {/* Step 3: Email */}
          {step === 'email' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {result && (
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span className="text-xs text-zinc-500 truncate">{result.name}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="you@restaurant.com"
                  autoFocus
                />
                <p className="text-xs text-zinc-600">Suggested replies will be sent here whenever new reviews come in.</p>
              </div>

              {submitError && (
                <div className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-xl px-4 py-3">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="btn-press mt-1 bg-zinc-100 text-zinc-900 text-sm font-semibold py-3 rounded-full hover:bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Setting up…
                  </>
                ) : (
                  'Start free trial'
                )}
              </button>

              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1"
              >
                Back
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-zinc-700">
            No credit card required · Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
