'use client'

import { useState, useEffect } from 'react'

export default function AutoDismissBanner({
  children,
  className,
  style,
  delay = 4000,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  delay?: number
}) {
  const [fading, setFading] = useState(false)
  const [gone, setGone] = useState(false)

  function dismiss() {
    setFading(true)
    setTimeout(() => setGone(true), 600)
  }

  useEffect(() => {
    if (delay > 0) {
      const t = setTimeout(dismiss, delay)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (gone) return null

  return (
    <div
      style={{
        overflow: 'hidden',
        opacity: fading ? 0 : 1,
        maxHeight: fading ? 0 : 200,
        marginBottom: fading ? 0 : (style?.marginBottom ?? 16),
        // Fade out first, then collapse the space after a brief delay
        transition: fading
          ? 'opacity 0.25s ease, max-height 0.4s ease 0.2s, margin-bottom 0.4s ease 0.2s'
          : 'none',
      }}
    >
      <div className={className} style={{ ...style, marginBottom: 0 }}>
        {children}
      </div>
    </div>
  )
}
