'use client'

import { useState } from 'react'
import { copyToClipboard } from './CopyButton'

type State = 'idle' | 'posting' | 'done' | 'error'

interface Props {
  replyText: string
  reviewId: string | null  // null = demo mode, skips API call
  onReplied?: () => void
}

const statusStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 28, padding: '0 12px',
  borderRadius: 'var(--r-pill)',
  fontSize: 12, fontWeight: 500,
  whiteSpace: 'nowrap', cursor: 'default', pointerEvents: 'none',
}

export default function PostReplyButton({ replyText, reviewId, onReplied }: Props) {
  const [state, setState] = useState<State>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleClick() {
    setState('posting')
    setErrorMsg(null)

    if (reviewId) {
      try {
        const res = await fetch('/api/post-reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reviewId, replyText }),
        })
        const data = await res.json()

        if (res.ok) {
          setState('done')
          onReplied?.()
          setTimeout(() => setState('idle'), 4000)
          return
        }

        if (data.code === 'NOT_CONNECTED' || data.code === 'NO_LOCATION') {
          await copyToClipboard(replyText)
          window.open('https://business.google.com/reviews', '_blank', 'noopener,noreferrer')
          setState('done')
          setTimeout(() => setState('idle'), 3000)
          return
        }

        setErrorMsg(data.error ?? 'Failed to post.')
        setState('error')
        setTimeout(() => { setState('idle'); setErrorMsg(null) }, 4000)
      } catch {
        setErrorMsg('Network error — try copying manually.')
        setState('error')
        setTimeout(() => { setState('idle'); setErrorMsg(null) }, 4000)
      }
    } else {
      await copyToClipboard(replyText)
      window.open('https://business.google.com/reviews', '_blank', 'noopener,noreferrer')
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return (
      <span style={{ ...statusStyle, background: 'var(--pos-sub)', color: 'var(--pos)', border: '1px solid var(--pos-line)' }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        {reviewId ? 'Posted' : 'Copied'}
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span
        role="alert"
        title={errorMsg ?? 'Error'}
        style={{ ...statusStyle, background: 'var(--neg-sub)', color: 'var(--neg)', border: '1px solid var(--neg-line)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {errorMsg ?? 'Error posting'}
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'posting'}
      className="btn btn-sm btn-primary btn-press"
    >
      {state === 'posting' ? (
        <span className="spin" style={{ display: 'inline-flex' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        </span>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
          Reply on Google
        </>
      )}
    </button>
  )
}
