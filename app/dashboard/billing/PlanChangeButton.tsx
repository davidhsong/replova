'use client'

import { useState } from 'react'

type Plan = 'starter' | 'growth' | 'agency'

interface Props {
  targetPlan: Plan
  targetLabel: string
  targetPrice: number
  variant: 'upgrade' | 'downgrade'
  priceDiff: number
}

export default function PlanChangeButton({ targetPlan, targetLabel, targetPrice, variant, priceDiff }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    const msg = variant === 'upgrade'
      ? `Upgrade to ${targetLabel} ($${targetPrice}/mo)?\n\nYou'll be charged a prorated amount today.`
      : `Downgrade to ${targetLabel} ($${targetPrice}/mo)?\n\nA credit will be applied to your next invoice.`

    if (!window.confirm(msg)) return

    setLoading(true)
    try {
      const res = await fetch('/api/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to change plan.')
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to change plan. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`btn ${variant === 'upgrade' ? 'btn-primary' : 'btn-ghost'}`}
        style={{ width: 200 }}
      >
        {loading ? (
          <>
            <span className="spin" style={{ display: 'inline-flex' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-6.219-8.56"/>
              </svg>
            </span>
            Switching…
          </>
        ) : variant === 'upgrade' ? `Upgrade to ${targetLabel}` : `Downgrade to ${targetLabel}`}
      </button>
      <span className="t-xs c-t3">
        {priceDiff > 0 ? `+$${priceDiff}/mo · prorated` : `Save $${Math.abs(priceDiff)}/mo`}
      </span>
    </div>
  )
}
