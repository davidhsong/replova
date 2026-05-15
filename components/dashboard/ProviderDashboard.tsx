'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import ProviderCard from './ProviderCard'
import { IconLock } from '@/components/icons'
import type { ProviderStats } from '@/lib/providerStats'
import type { Plan } from '@/lib/planLimits'

interface Props {
  restaurantId: string
  plan: Plan
}

const CARD: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-7)',
  padding: 20,
}

export default function ProviderDashboard({ restaurantId, plan }: Props) {
  const [providers, setProviders] = useState<ProviderStats[] | null>(null)
  const [loading, setLoading] = useState(true)

  const isLocked = plan === 'starter'

  useEffect(() => {
    if (isLocked) {
      setLoading(false)
      return
    }
    fetch(`/api/providers/stats?restaurantId=${restaurantId}`)
      .then(r => r.json())
      .then(data => {
        setProviders(data.providers ?? [])
        setLoading(false)
      })
      .catch(() => {
        setProviders([])
        setLoading(false)
      })
  }, [restaurantId, isLocked])

  if (isLocked) {
    return (
      <div style={{
        ...CARD,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: '20px 16px', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--r-5)',
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--t3)',
        }}>
          <IconLock s={14} />
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Team Reputation</p>
          <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
            See which staff members drive your best reviews. Available on Studio and above.
          </p>
        </div>
        <Link href="/dashboard/billing" style={{
          fontSize: 12, fontWeight: 600, color: 'var(--accent)',
          background: 'var(--accent-sub)', borderRadius: 'var(--r-pill)',
          padding: '4px 12px', border: '1px solid var(--accent-line)',
        }}>
          Upgrade to Studio
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4,
        }}>
          Team Reputation
        </div>
        <p style={{ fontSize: 12, color: 'var(--t3)' }}>
          Based on staff mentions extracted from your reviews.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ ...CARD, height: 120, opacity: 0.4 }} />
          ))}
        </div>
      ) : providers && providers.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {providers.map((p, i) => (
            <ProviderCard key={p.name} provider={p} rank={i + 1} />
          ))}
        </div>
      ) : (
        <div style={{ ...CARD, textAlign: 'center', padding: '28px 20px' }}>
          <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 6 }}>No staff mentions yet</p>
          <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>
            As reviews come in, we&apos;ll track which team members are mentioned most.
          </p>
        </div>
      )}
    </div>
  )
}
