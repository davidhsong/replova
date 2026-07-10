'use client'

import { useState } from 'react'
import type { Plan } from '@/lib/planLimits'

const PLAN_META: Record<Plan, { label: string; price: number; color: string }> = {
  starter: { label: 'Starter', price: 79,  color: '#6366f1' },
  growth:  { label: 'Growth',  price: 179, color: '#3b82f6' },
  agency:  { label: 'Agency',  price: 349, color: '#8b5cf6' },
}

const PLAN_FEATURES: Record<Plan, string[]> = {
  starter: [
    'AI reply drafts (3 tones per review)',
    'Urgent review alerts by email',
    'Weekly digest with action items',
    'Review request campaigns',
    '1 location · 3 competitor slots',
  ],
  growth: [
    'Everything in Starter',
    'Reputation score (0–100) tracked over time',
    'Sentiment analysis, keyword cloud & staff shoutouts',
    'Competitor tracking (5 per location)',
    'Monthly PDF report',
    'Up to 5 locations',
  ],
  agency: [
    'Everything in Growth',
    'Custom reply persona (your tone, your voice)',
    'White-label PDF reports with your logo',
    'Up to 15 locations · 10 competitor slots each',
  ],
}

interface Props {
  plan: Plan
  trialEndDate: string
}

export default function TermsModal({ plan, trialEndDate }: Props) {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)

  const meta = PLAN_META[plan]
  const features = PLAN_FEATURES[plan]

  async function handleAccept() {
    if (!agreed || loading) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/terms/accept', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to accept terms')
      setDone(true)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) return null

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}>
        {/* Modal */}
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90dvh',
          overflowY: 'auto',
          padding: '32px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, margin: '0 auto 14px',
              background: `${meta.color}22`,
              border: `1.5px solid ${meta.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-0.025em', marginBottom: 6 }}>
              Welcome to Replova {meta.label}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>
              Your 30-day free trial starts now.{' '}
              <span style={{ color: 'var(--t2)', fontWeight: 500 }}>No charge until {trialEndDate}.</span>
            </p>
          </div>

          {/* Plan badge */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderRadius: 12,
            background: `${meta.color}11`, border: `1px solid ${meta.color}33`,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
              {meta.label} plan
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>
              ${meta.price}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)' }}>/mo after trial</span>
            </span>
          </div>

          {/* What's included */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginBottom: 10 }}>
            What&apos;s included
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {features.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* Legal links */}
          <div style={{
            padding: '12px 14px', borderRadius: 10,
            background: 'var(--surface-0)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 6,
            marginBottom: 18,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', marginBottom: 2 }}>Before you start, please review:</p>
            {[
              { href: '/terms', label: 'Terms of Service' },
              { href: '/privacy', label: 'Privacy Policy' },
              { href: '/refunds', label: 'Refund Policy' },
            ].map(({ href, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                {label}
              </a>
            ))}
          </div>

          {/* Agreement checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 20 }}>
            <div
              onClick={() => setAgreed(v => !v)}
              style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: `2px solid ${agreed ? 'var(--accent)' : 'var(--border-md)'}`,
                background: agreed ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.12s',
              }}
            >
              {agreed && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
              I have read and agree to Replova&apos;s{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline' }}>Terms of Service</a>,{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline' }}>Privacy Policy</a>, and{' '}
              <a href="/refunds" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--t1)', fontWeight: 600, textDecoration: 'underline' }}>Refund Policy</a>.
            </span>
          </label>

          {error && (
            <p style={{ fontSize: 12, color: 'var(--err)', textAlign: 'center', marginBottom: 12 }}>
              Something went wrong saving your agreement. Please try again.
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleAccept}
            disabled={!agreed || loading}
            style={{
              width: '100%', padding: '13px 20px',
              background: agreed ? 'var(--accent)' : 'var(--surface-2)',
              color: agreed ? '#fff' : 'var(--t3)',
              border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700,
              cursor: agreed && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
            }}
          >
            {loading ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Starting…
              </>
            ) : (
              <>
                Start my free trial
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 8l4 4m0 0l-4 4m4-4H3"/>
                </svg>
              </>
            )}
          </button>

          <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', marginTop: 10 }}>
            Cancel anytime · No credit card required during trial
          </p>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
