'use client'

import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
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
