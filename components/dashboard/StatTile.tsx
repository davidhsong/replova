import type { ReactNode } from 'react'
import { IconArrowUp, IconArrowDown } from '@/components/icons'

type Props = {
  label: string
  value: ReactNode
  sub?: string
  delta?: number
  sparkline?: ReactNode
  urgent?: boolean
  allClear?: boolean
}

export default function StatTile({ label, value, sub, delta, sparkline, urgent, allClear }: Props) {
  const bg = urgent ? 'var(--neg-sub)' : allClear ? 'var(--pos-sub)' : 'var(--surface)'
  const bd = urgent ? 'var(--neg-line)' : allClear ? 'var(--pos-line)' : 'var(--line)'
  const lc = urgent ? 'var(--neg)' : allClear ? 'var(--pos)' : 'var(--t3)'

  return (
    <div style={{
      flex: 1, padding: '16px 18px',
      background: bg, border: `1px solid ${bd}`,
      borderRadius: 'var(--r-6)',
      display: 'flex', flexDirection: 'column', gap: 6,
      transition: 'background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="t-eyebrow" style={{ color: lc }}>{label}</div>
        {sparkline}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="t-serif tnum" style={{
          fontSize: 32, lineHeight: 1, letterSpacing: '-0.02em',
          color: urgent ? 'var(--neg)' : 'var(--t1)',
        }}>
          {value}
        </span>
        {delta !== undefined && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 11, fontWeight: 600,
            color: delta > 0 ? 'var(--pos)' : delta < 0 ? 'var(--neg)' : 'var(--t3)',
          }}>
            {delta > 0 ? <IconArrowUp s={10} /> : delta < 0 ? <IconArrowDown s={10} /> : null}
            {delta > 0 ? `+${delta}` : delta}
          </span>
        )}
      </div>
      {sub && <div className="t-xs c-t3">{sub}</div>}
    </div>
  )
}
