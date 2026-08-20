'use client'

import { Fragment, useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'

type Step = 'search' | 'confirm' | 'email' | 'success'
type Plan = 'starter' | 'growth' | 'agency'

interface PlaceResult {
  placeId: string
  name: string
  address: string
}

function Logo({ size = 20 }: { size?: number }) {
  const box = size + 6;
  return (
    <Image
      src="/replova-logo.png"
      alt="Replova"
      width={box}
      height={box}
      style={{ borderRadius: Math.round(box * 0.35), flexShrink: 0 }}
    />
  );
}

const STEP_LABELS: Record<Step, string> = {
  search: 'Find business',
  confirm: 'Confirm',
  email: 'Your email',
  success: 'Done',
}
const STEP_ORDER: Step[] = ['search', 'confirm', 'email']

function StepDots({ current }: { current: Step }) {
  const idx = STEP_ORDER.indexOf(current)
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 48 }}>
      {STEP_ORDER.map((s, i) => (
        <Fragment key={s}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '1px solid',
              borderColor: i <= idx ? 'var(--accent)' : 'var(--line-md)',
              background: i < idx ? 'var(--accent)' : i === idx ? 'var(--surface)' : 'transparent',
              color: i < idx ? '#fff' : i === idx ? 'var(--accent)' : 'var(--t3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600, flexShrink: 0,
            }}>
              {i < idx ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : i + 1}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: i === idx ? 'var(--t1)' : 'var(--t3)', letterSpacing: '0.01em' }}>
              {STEP_LABELS[s]}
            </span>
          </div>
          {i < STEP_ORDER.length - 1 && (
            <div style={{ flex: 1, height: 1, background: i < idx ? 'var(--accent)' : 'var(--line)', margin: '0 16px' }} />
          )}
        </Fragment>
      ))}
    </div>
  )
}

function resolvePlan(raw: string | null): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

function Spinner() {
  return (
    <span className="spin" style={{ display: 'inline-flex' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
    </span>
  )
}

function OnboardPageContent() {
  const searchParams = useSearchParams()
  const plan = resolvePlan(searchParams.get('plan'))
  const addMode = searchParams.get('add') === 'true'

  const [step, setStep] = useState<Step>('search')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(!addMode)

  const [restaurantName, setRestaurantName] = useState('')
  const [city, setCity] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [result, setResult] = useState<PlaceResult | null>(null)

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState('')

  useEffect(() => {
    if (!addMode) return
    void (async () => {
      const { data } = await getSupabaseBrowser().auth.getUser()
      if (data.user?.email) {
        setSessionEmail(data.user.email)
      } else {
        window.location.replace('/signin?next=%2Fonboard%3Fadd%3Dtrue')
      }
      setSessionChecked(true)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    if (addMode) {
      if (!sessionChecked || !sessionEmail) return
      await createRestaurant(sessionEmail)
      return
    }
    setStep('email')
  }

  async function createRestaurant(ownerEmail: string) {
    if (!result) return
    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch('/api/restaurants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name, email: ownerEmail, placeId: result.placeId, plan, addMode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add location.')

      if (addMode) {
        window.location.replace('/dashboard')
        return
      }

      const next = data.alreadyExists
        ? '/dashboard'
        : `/api/create-checkout?plan=${plan}`
      const magicLinkRes = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, next }),
      })
      const magicLinkData = await magicLinkRes.json().catch(() => ({}))
      if (!magicLinkRes.ok) {
        throw new Error(magicLinkData.error ?? 'Unable to send your sign-in link.')
      }

      setSuccessEmail(ownerEmail)
      setStep('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createRestaurant(email)
  }

  const headings: Record<Step, string> = {
    search: addMode ? 'Add a new location.' : 'Find your business.',
    confirm: 'Is this your business?',
    email: 'Where should we send the replies?',
    success: '',
  }

  const subheadings: Record<Step, string> = {
    search: addMode ? 'Search for the location you want to add.' : 'We use Google Places to connect your business listing and start syncing reviews.',
    confirm: 'Verify we found the right listing.',
    email: "We'll send you AI suggested replies whenever new reviews come in.",
    success: '',
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }} className="fade-up">
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--pos-sub)', border: '1px solid var(--pos-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--pos)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>You&apos;re all set</h1>
          <p className="t-sm c-t2" style={{ lineHeight: 1.65 }}>
            We sent a sign-in link to{' '}
            <strong style={{ color: 'var(--t1)' }}>{successEmail}</strong>.{' '}
            Click it to continue securely to checkout and start your trial.
          </p>
          <p className="t-xs c-t4" style={{ marginTop: 16 }}>
            You&apos;ll get AI-drafted replies and alerts as new reviews come in.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={18} />
          </Link>
          <a href="/signin" className="t-xs c-t3" style={{ textDecoration: 'none', fontSize: 12 }}>
            Already have an account?{' '}
            <span style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline', marginLeft: 4 }}>Sign in</span>
          </a>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 880, width: '100%', margin: '0 auto', padding: '56px 32px' }}>

        <div className="t-eyebrow" style={{ marginBottom: 12 }}>
          Step {STEP_ORDER.indexOf(step) + 1} of {STEP_ORDER.length}
        </div>
        <h1 className="t-serif" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {headings[step]}
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t2)', marginBottom: 40, maxWidth: 560, lineHeight: 1.6 }}>
          {subheadings[step]}
        </p>

        <StepDots current={step} />

        {/* Step 1: Search */}
        {step === 'search' && (
          <form onSubmit={handleSearch} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="t-eyebrow" style={{ display: 'block', marginBottom: 8 }} htmlFor="rname">
                Business name
              </label>
              <input
                id="rname"
                type="text"
                required
                value={restaurantName}
                onChange={e => setRestaurantName(e.target.value)}
                className="field field-lg"
                placeholder="Glow Aesthetics"
                autoFocus
              />
            </div>
            <div>
              <label className="t-eyebrow" style={{ display: 'block', marginBottom: 8 }} htmlFor="city">
                City
              </label>
              <input
                id="city"
                type="text"
                required
                value={city}
                onChange={e => setCity(e.target.value)}
                className="field field-lg"
                placeholder="New York"
              />
            </div>

            {searchError && (
              <div style={{ padding: '10px 12px', background: 'var(--neg-sub)', border: '1px solid var(--neg-line)', borderRadius: 8, fontSize: 13, color: 'var(--neg)' }}>
                {searchError}
              </div>
            )}

            <div style={{ marginTop: 4, paddingTop: 24, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={searching || !restaurantName.trim() || !city.trim()}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {searching ? <><Spinner /> Searching…</> : 'Find my business'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Confirm */}
        {step === 'confirm' && result && (
          <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--t3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{result.name}</p>
                  <p className="t-xs c-t3" style={{ lineHeight: 1.5 }}>{result.address}</p>
                </div>
              </div>
            </div>

            {submitError && (
              <div style={{ padding: '10px 12px', background: 'var(--neg-sub)', border: '1px solid var(--neg-line)', borderRadius: 8, fontSize: 13, color: 'var(--neg)' }}>
                {submitError}
              </div>
            )}

            <div style={{ paddingTop: 24, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => { setStep('search'); setResult(null); setSearchError(null) }}
              >
                ← Search again
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || (addMode && !sessionChecked)}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {submitting
                  ? <><Spinner /> Adding…</>
                  : addMode && sessionEmail ? 'Add this location' : 'Yes, this is my business'
                }
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Email */}
        {step === 'email' && (
          <form onSubmit={handleSubmit} className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span className="t-xs c-t3" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.name}</span>
              </div>
            )}

            <div>
              <label className="t-eyebrow" style={{ display: 'block', marginBottom: 8 }} htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="field field-lg"
                placeholder="owner@yourpractice.com"
                autoFocus
              />
              <p className="t-xs c-t4" style={{ marginTop: 6 }}>Suggested replies will be sent here whenever new reviews come in.</p>
            </div>

            {submitError && (
              <div style={{ padding: '10px 12px', background: 'var(--neg-sub)', border: '1px solid var(--neg-line)', borderRadius: 8, fontSize: 13, color: 'var(--neg)' }}>
                {submitError}
              </div>
            )}

            <div style={{ marginTop: 4, paddingTop: 24, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-quiet" onClick={() => setStep('confirm')}>
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {submitting ? <><Spinner /> Setting up…</> : 'Start free trial'}
              </button>
            </div>
          </form>
        )}

        <p className="t-xs c-t4" style={{ marginTop: 32, textAlign: 'center' }}>
          30 days free · Cancel anytime
        </p>
      </main>
    </div>
  )
}

export default function OnboardPage() {
  return (
    <Suspense>
      <OnboardPageContent />
    </Suspense>
  )
}
