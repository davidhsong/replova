'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Location = { id: string; name: string }

type Props = {
  locations: Location[]
  activeLocationId: string
  locationLimit: number
  currentCount: number
}

export default function LocationSwitcherClient({ locations, activeLocationId, locationLimit, currentCount }: Props) {
  const router = useRouter()
  const [switching, setSwitching] = useState(false)
  const atLimit = currentCount >= locationLimit

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newId = e.target.value
    if (newId === activeLocationId) return
    setSwitching(true)
    try {
      await fetch('/api/active-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId: newId }),
      })
      router.refresh()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <select
        value={activeLocationId}
        onChange={handleChange}
        disabled={switching}
        style={{
          width: '100%',
          background: 'var(--surface-2)',
          border: '1px solid var(--line-md)',
          borderRadius: 6,
          padding: '6px 28px 6px 10px',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--t1)',
          fontFamily: 'inherit',
          cursor: switching ? 'wait' : 'pointer',
          opacity: switching ? 0.6 : 1,
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23807c70' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {locations.map(loc => (
          <option key={loc.id} value={loc.id}>{loc.name}</option>
        ))}
      </select>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6 }}>
        {atLimit ? (
          <a
            href="/dashboard/billing"
            style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}
            title="Upgrade to add more locations"
          >
            Upgrade plan ↑
          </a>
        ) : (
          <a
            href="/onboard?add=true"
            style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}
          >
            + Add location
          </a>
        )}
      </div>
    </div>
  )
}
