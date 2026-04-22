'use client'

import { useState } from 'react'
import { copyToClipboard } from './CopyButton'

type State = 'idle' | 'posting' | 'done' | 'error'

interface Props {
  replyText: string
  reviewId: string | null  // null = demo mode, skips API call
  onReplied?: () => void
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

        // Google not connected — fall back to copy + open
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
      // Demo mode — copy + open browser
      await copyToClipboard(replyText)
      window.open('https://business.google.com/reviews', '_blank', 'noopener,noreferrer')
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    }
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-900 whitespace-nowrap">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        {reviewId ? 'Posted to Google' : 'Copied & opened'}
      </span>
    )
  }

  if (state === 'error') {
    return (
      <span
        role="alert"
        title={errorMsg ?? 'Error'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-950 text-red-400 border border-red-900 whitespace-nowrap max-w-50 truncate"
      >
        {errorMsg ?? 'Error posting'}
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'posting'}
      className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {state === 'posting' ? (
        <>
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Posting…
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Reply on Google
        </>
      )}
    </button>
  )
}
