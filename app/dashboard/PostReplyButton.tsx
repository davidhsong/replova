'use client'

import { useState } from 'react'
import { copyToClipboard } from './CopyButton'

type State = 'idle' | 'working' | 'done'

export default function PostReplyButton({ replyText }: { replyText: string }) {
  const [state, setState] = useState<State>('idle')

  async function handleClick() {
    setState('working')
    await copyToClipboard(replyText)
    window.open('https://business.google.com/reviews', '_blank', 'noopener,noreferrer')
    setState('done')
    setTimeout(() => setState('idle'), 3000)
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-900 whitespace-nowrap">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Copied &amp; opened
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'working'}
      className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {state === 'working' ? (
        <>
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Opening…
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
