'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { authLinkErrorMessage } from '@/lib/authError'
import { safeRedirectPath } from '@/lib/safeRedirect'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'

type RequestState = 'idle' | 'loading' | 'sent' | 'error'

function getNextPath(): string {
  const raw = new URLSearchParams(window.location.search).get('next')
  return safeRedirectPath(raw)
}

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<RequestState>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const message = authLinkErrorMessage(
      window.location.search,
      window.location.hash,
    )
    if (message) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
      const timer = window.setTimeout(() => {
        setError(message)
        setState('error')
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    if (window.location.hash.includes('access_token')) return
    void (async () => {
      const response = await fetch('/api/auth/session', { cache: 'no-store' }).catch(() => null)
      const data = response ? await response.json().catch(() => ({})) : {}
      if (data.authenticated) {
        const next = getNextPath()
        if (next.startsWith('/api/')) window.location.replace(next)
        else router.replace(next)
      }
    })()
  }, [router])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) {
      const timer = window.setTimeout(() => {
        setError('Sign-in link was malformed. Request a new one.')
        setState('error')
      }, 0)
      return () => window.clearTimeout(timer)
    }

    void (async () => {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, refreshToken }),
      }).catch(() => null)
      const data = response ? await response.json().catch(() => ({})) : {}
      if (response?.ok && data.authenticated) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
        const next = getNextPath()
        if (next.startsWith('/api/')) window.location.replace(next)
        else router.replace(next)
      } else {
        setError(data.error ?? 'Sign-in failed. Request a new link and try again.')
        setState('error')
      }
    })()
  }, [router])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setState('loading')
    setError(null)

    try {
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), next: getNextPath() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }

      setState('sent')
    } catch {
      setError('The sign-in service is unavailable. Check the local environment settings and try again.')
      setState('error')
    }
  }

  return (
    <main id="main-content" className="signin-shell">
      <Link className="signin-brand" href="/" aria-label="Replova home">
        <ReplovaLogo variant="primary" surface="light" height={30} decorative eager />
      </Link>

      <section className="signin-card" aria-labelledby="signin-title">
        {state === 'sent' ? (
          <div className="signin-state fade-up">
            <span className="signin-state-icon" aria-hidden="true">&#10003;</span>
            <p className="t-eyebrow">Secure link sent</p>
            <h1 id="signin-title">Check your email</h1>
            <p>We sent a one-time sign-in link to <strong>{email}</strong>. Use the newest link you receive.</p>
            <button className="signin-secondary-button" type="button" onClick={() => { setState('idle'); setEmail('') }}>
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="signin-email-form">
            <div className="signin-heading">
              <p className="t-eyebrow">Account access</p>
              <h1 id="signin-title">Sign in to Replova</h1>
              <p>Enter the email registered to your account. We&apos;ll send a one-time secure link.</p>
            </div>

            <label htmlFor="signin-email">Work email</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="owner@yourbusiness.com"
              value={email}
              onChange={event => { setEmail(event.target.value); setError(null); setState('idle') }}
              aria-invalid={state === 'error'}
            />
            {error && <p className="signin-error" role="alert">{error}</p>}
            <button className="signin-submit" type="submit" disabled={state === 'loading' || !email.trim()}>
              {state === 'loading' ? 'Sending link...' : 'Send sign-in link'}
            </button>
            <p className="signin-card-footer">New to Replova? <Link href="/onboard">Create an account.</Link></p>
          </form>
        )}
      </section>

      <Link className="signin-preview-link" href="/dashboard-preview">
        Explore the dashboard with sample data <span aria-hidden="true">&#8599;</span>
      </Link>

      <p className="signin-legal">
        By signing in, you agree to Replova&apos;s <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </main>
  )
}
