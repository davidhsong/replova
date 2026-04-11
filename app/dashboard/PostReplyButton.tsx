'use client'

import { useState } from 'react'

type State = 'idle' | 'working' | 'done'

export default function PostReplyButton({
  replyText,
  restaurantName,
}: {
  replyText: string
  restaurantName: string
}) {
  const [state, setState] = useState<State>('idle')

  async function handleClick() {
    setState('working')

    // Copy reply text to clipboard
    try {
      await navigator.clipboard.writeText(replyText)
    } catch {
      // Clipboard API blocked — still open the tab
    }

    // Open the Google Business Profile reviews page — works for both regular
    // accounts and location groups (search panel doesn't show reviews for groups)
    const searchUrl = `https://business.google.com/reviews`
    window.open(searchUrl, '_blank', 'noopener,noreferrer')

    setState('done')
    setTimeout(() => setState('idle'), 3000)
  }

  if (state === 'done') {
    return (
      <span className="px-3 py-1 text-xs font-medium rounded bg-emerald-950 text-emerald-400 border border-emerald-900 whitespace-nowrap">
        Copied & opened ✓
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'working'}
      className="px-3 py-1 text-xs font-medium rounded transition-colors bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {state === 'working' ? 'Opening…' : 'Reply on Google'}
    </button>
  )
}
