'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'

type SubmitState = 'idle' | 'loading' | 'sent' | 'error'

export default function AccountSignup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetch('/api/auth/session', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (data.authenticated) router.replace('/onboard/workspace')
      })
      .catch(() => undefined)
  }, [router])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('loading')
    setError(null)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? 'Unable to start signup. Please try again.')
        setState('error')
        return
      }
      setState('sent')
    } catch {
      setError('The signup service is unavailable. Please try again.')
      setState('error')
    }
  }

  return (
    <main id="main-content" className="account-onboarding-shell">
      <header className="account-onboarding-header">
        <Link href="/" aria-label="Replova home">
          <ReplovaLogo variant="primary" surface="light" height={25} decorative eager />
        </Link>
        <p>Already have an account? <Link href="/signin">Sign in</Link></p>
      </header>

      <div className="account-onboarding-grid">
        <section className="account-onboarding-intro" aria-labelledby="signup-title">
          <p className="t-eyebrow">Create your Replova account</p>
          <h1 id="signup-title">Create your business workspace.</h1>
          <p className="account-onboarding-lead">
            Start with your email and business name. You can set up Tap without a Google listing.
          </p>
          <ol className="account-onboarding-steps" aria-label="Account setup steps">
            <li data-state="current"><span>01</span><div><strong>Verify your email</strong><small>Use a secure, one-time link.</small></div></li>
            <li><span>02</span><div><strong>Name your workspace</strong><small>Enter the business name your team uses.</small></div></li>
            <li><span>03</span><div><strong>Set up your first location</strong><small>Open Tap when your workspace has access.</small></div></li>
          </ol>
        </section>

        <section className="account-onboarding-form-panel" aria-label="Email signup">
          {state === 'sent' ? (
            <div className="account-onboarding-success" aria-live="polite">
              <p className="t-eyebrow">Verification sent</p>
              <h2>Check your inbox</h2>
              <p>
                We sent a secure link to <strong>{email.trim().toLowerCase()}</strong>.
                Open the newest message to continue and name your workspace.
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setEmail(''); setState('idle') }}
              >
                Use another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="account-onboarding-form-heading">
                <p className="t-eyebrow">Step 1 of 2</p>
                <h2>Create your account</h2>
                <p>We will email you a one-time verification link. No password required.</p>
              </div>
              <div className="account-onboarding-field">
                <label htmlFor="signup-email">Work email</label>
                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  maxLength={320}
                  value={email}
                  placeholder="owner@yourbusiness.com"
                  aria-invalid={state === 'error'}
                  aria-describedby={error ? 'signup-error' : 'signup-email-help'}
                  onChange={event => { setEmail(event.target.value); setError(null); setState('idle') }}
                />
                <small id="signup-email-help">Use the inbox that should own this Replova account.</small>
                {error && <p id="signup-error" className="account-onboarding-error" role="alert">{error}</p>}
              </div>
              <button
                className="btn btn-primary account-onboarding-submit"
                type="submit"
                disabled={state === 'loading' || !email.trim()}
              >
                {state === 'loading' ? 'Sending secure link...' : 'Continue with email'}
              </button>
              <p className="account-onboarding-terms">
                By continuing, you agree to the <Link href="/terms">Terms</Link> and{' '}
                <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
