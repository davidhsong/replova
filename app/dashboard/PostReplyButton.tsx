'use client'

import { useState } from 'react'

type PostState = 'idle' | 'posting' | 'success' | 'error'

export default function PostReplyButton({
  reviewId,
  replyText,
  googleConnected,
  alreadyReplied,
}: {
  reviewId: string
  replyText: string
  googleConnected: boolean
  alreadyReplied: boolean
}) {
  const [state, setState] = useState<PostState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Already replied — show a static badge
  if (alreadyReplied && state !== 'success') {
    return (
      <span className="px-3 py-1 text-xs font-medium rounded bg-indigo-950 text-indigo-400 border border-indigo-900 whitespace-nowrap">
        Replied ✓
      </span>
    )
  }

  // Google not connected — prompt to connect
  if (!googleConnected) {
    return (
      <a
        href="/dashboard/settings"
        className="px-3 py-1 text-xs font-medium rounded transition-colors bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 whitespace-nowrap"
        title="Connect your Google Business account to post replies directly"
      >
        Connect Google
      </a>
    )
  }

  async function handlePost() {
    setState('posting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/post-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, replyText }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Session expired — redirect to reconnect
        if (data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_EXPIRED') {
          window.location.href = '/api/auth/google'
          return
        }
        // Not connected — redirect to settings
        if (data.code === 'NOT_CONNECTED' || data.code === 'NO_LOCATION') {
          window.location.href = '/dashboard/settings'
          return
        }
        throw new Error(data.error ?? 'Failed to post reply')
      }

      setState('success')
    } catch (err) {
      setState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to post reply')
      setTimeout(() => setState('idle'), 5000)
    }
  }

  if (state === 'success') {
    return (
      <span className="px-3 py-1 text-xs font-medium rounded bg-indigo-950 text-indigo-400 border border-indigo-900 whitespace-nowrap">
        Posted ✓
      </span>
    )
  }

  if (state === 'error') {
    return (
      <button
        onClick={() => setState('idle')}
        title={errorMessage}
        className="px-3 py-1 text-xs font-medium rounded bg-red-950 text-red-400 border border-red-900 max-w-[200px] truncate"
      >
        {errorMessage}
      </button>
    )
  }

  return (
    <button
      onClick={handlePost}
      disabled={state === 'posting'}
      className="px-3 py-1 text-xs font-medium rounded transition-colors bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
    >
      {state === 'posting' ? 'Posting…' : 'Post to Google'}
    </button>
  )
}
