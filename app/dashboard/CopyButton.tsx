'use client'

import { useState } from 'react'

export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy
    }
  }
  // Legacy textarea fallback
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
        copied
          ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
          : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
      }`}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
