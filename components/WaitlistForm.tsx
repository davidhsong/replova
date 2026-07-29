'use client';

import { useState } from 'react';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, businessName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('done');
    } catch {
      setErrorMsg('Something went wrong. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div
        className="fade-in"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderRadius: 'var(--r-5)',
          background: 'var(--pos-sub)', border: '1px solid var(--pos-line)',
          color: 'var(--pos)', fontSize: 14, fontWeight: 500,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
        You&apos;re on the list. We&apos;ll email you the moment we&apos;re back open.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          required
          placeholder="you@yourbusiness.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field field-lg"
          disabled={status === 'loading'}
        />
        <input
          type="text"
          placeholder="Business name (optional)"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="field field-lg"
          disabled={status === 'loading'}
        />
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-press"
          disabled={status === 'loading'}
          style={{ width: '100%' }}
        >
          {status === 'loading' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {status === 'error' && (
        <p className="t-xs" style={{ color: 'var(--neg)', marginTop: 8 }}>{errorMsg}</p>
      )}
    </form>
  );
}
