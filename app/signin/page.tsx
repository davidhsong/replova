'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getSupabaseBrowser } from '@/lib/supabase'

type State = 'idle' | 'loading' | 'sent' | 'error'

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

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Show error when redirected back from a failed magic-link verification
    const params = new URLSearchParams(window.location.search)
    if (params.get('error') === 'invalid_link') {
      setError('That sign-in link has expired or already been used. Request a new one.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    // Redirect already-authenticated users straight to the dashboard.
    // If the refresh token is stale, sign out silently so the bad cookies are cleared.
    void (async () => {
      const supabase = getSupabaseBrowser()
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        await supabase.auth.signOut()
        return
      }
      if (user) router.replace('/dashboard')
    })()
  }, [router])

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) {
      console.error('[signin] hash had access_token but was missing a required field:', hash)
      setError('Sign-in link was malformed. Request a new one.')
      setState('error')
      return
    }
    void (async () => {
      const supabase = getSupabaseBrowser()
      const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      if (!sessionError) {
        router.replace('/dashboard')
      } else {
        console.error('[signin] setSession failed:', sessionError.message)
        setError(`Sign-in failed: ${sessionError.message}`)
        setState('error')
      }
    })()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError(null)

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        // /api/auth/magic-link's server-side Supabase client defaults to
        // implicit flow (unlike the PKCE-configured browser client used by
        // onboarding), so the session lands as a #access_token hash fragment,
        // not a ?code query param. Route back to /signin itself, which already
        // has a client-side handler for that hash — not /auth/callback, which
        // is a server route and can never see a URL fragment.
        redirectTo: `${window.location.origin}/signin`,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      setState('error')
    } else {
      setState('sent')
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Logo size={18} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--t1)' }}>Replova</span>
          </Link>
          <a href="/onboard" className="t-xs c-t3" style={{ textDecoration: 'none' }}>
            No account? <span style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline', marginLeft: 4 }}>Start a trial</span>
          </a>
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.05fr 1fr', maxWidth: 1140, width: '100%', margin: '0 auto', padding: '48px 32px', gap: 80, alignItems: 'center' }}>
        <div className="fade-up">
          <div className="t-eyebrow" style={{ marginBottom: 20 }}>Sign in</div>
          <h1 className="t-serif" style={{ fontSize: 54, lineHeight: 1.0, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Magic link.<br />No password.<br />
            <span style={{ fontStyle: 'italic', color: 'var(--t3)' }}>Ever.</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--t2)', maxWidth: 380, lineHeight: 1.65 }}>
            We email a link straight to the address on your account. Click it; you&apos;re in.
            Nothing to remember, nothing to reset.
          </p>
        </div>

        <div className="card fade-up" style={{ padding: 36, maxWidth: 440, justifySelf: 'end', width: '100%', boxShadow: 'var(--shadow-2)' }}>
          {state === 'sent' ? (
            <div className="fade-up">
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--pos-sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pos)', marginBottom: 18 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 8 }}>Check your email.</h2>
              <p className="t-sm c-t2" style={{ marginBottom: 24, lineHeight: 1.6 }}>
                We sent a sign-in link to <strong style={{ color: 'var(--t1)' }}>{email}</strong>. It expires in 15 minutes.
              </p>
              <button className="btn btn-ghost btn-sm" onClick={() => { setState('idle'); setEmail('') }}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 6 }}>Welcome back.</h2>
              <p className="t-sm c-t3" style={{ marginBottom: 24 }}>Enter your work email.</p>

              <label className="t-eyebrow" style={{ display: 'block', marginBottom: 8 }}>Email</label>
              <input
                type="email"
                autoFocus
                required
                className="field field-lg"
                placeholder="maria@bellanapoli.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setState('idle') }}
                style={state === 'error' ? { borderColor: 'var(--neg-line)' } : {}}
              />

              {state === 'error' && error && (
                <div className="fade-in" style={{ marginTop: 10, padding: '8px 10px', background: 'var(--neg-sub)', border: '1px solid var(--neg-line)', borderRadius: 6, fontSize: 12, color: 'var(--neg)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}>
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    {error}
                    {error.includes('No account') && (
                      <a href="/onboard" style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 6, textDecoration: 'underline' }}>
                        Start trial →
                      </a>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {state === 'loading' ? (
                  <>
                    <span className="spin" style={{ display: 'inline-flex' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                    </span>
                    Sending…
                  </>
                ) : 'Send sign-in link'}
              </button>

              <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)', fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>
                New to Replova?{' '}
                <a href="/onboard" style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline' }}>Start a trial</a>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface)' }}>
        <div style={{ maxWidth: 1140, margin: '0 auto', padding: '20px 32px', textAlign: 'center' }}>
          <span className="t-xs c-t4">© {new Date().getFullYear()} Replova</span>
        </div>
      </footer>

    </div>
  )
}
