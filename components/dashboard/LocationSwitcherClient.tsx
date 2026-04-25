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
    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
      {locations.length > 1 ? (
        <select
          value={activeLocationId}
          onChange={handleChange}
          disabled={switching}
          style={{
            width: '100%',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-md)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--t1)',
            fontFamily: 'inherit',
            cursor: switching ? 'wait' : 'pointer',
            opacity: switching ? 0.6 : 1,
            appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            paddingRight: 28,
          }}
        >
          {locations.map(loc => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
      ) : (
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', padding: '4px 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {locations[0]?.name ?? ''}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--t3)' }}>
          {currentCount} of {locationLimit} location{locationLimit !== 1 ? 's' : ''} used
        </span>
        {atLimit ? (
          <a
            href="/dashboard/billing"
            style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
            title="Upgrade to add more locations"
          >
            Upgrade
          </a>
        ) : (
          <a
            href="/onboard?add=true"
            style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
          >
            + Add location
          </a>
        )}
      </div>
    </div>
  )
}
