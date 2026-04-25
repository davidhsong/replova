type Props = {
  value: number
  size?: number
  mode?: 'arc' | 'bar' | 'numeric'
}

export default function ScoreGauge({ value, size = 180, mode = 'arc' }: Props) {
  if (mode === 'numeric') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div className="t-serif" style={{ fontSize: 96, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.04em' }}>
          {value}
        </div>
        <div className="t-eyebrow" style={{ marginTop: 8 }}>out of 100</div>
      </div>
    )
  }

  if (mode === 'bar') {
    return (
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="t-serif" style={{ fontSize: 48, lineHeight: 1 }}>{value}</span>
          <span className="t-xs c-t3">/ 100</span>
        </div>
        <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${value}%`, height: '100%', background: 'var(--accent)', borderRadius: 4 }} />
        </div>
      </div>
    )
  }

  // arc mode
  const r = size / 2 - 14
  const cx = size / 2, cy = size / 2
  const start = -135, end = 135
  const angle = start + ((end - start) * value / 100)

  function arcPath(a1: number, a2: number) {
    const rad = (a: number) => (a - 90) * Math.PI / 180
    const x1 = cx + r * Math.cos(rad(a1)), y1 = cy + r * Math.sin(rad(a1))
    const x2 = cx + r * Math.cos(rad(a2)), y2 = cy + r * Math.sin(rad(a2))
    const large = (a2 - a1) > 180 ? 1 : 0
    return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <path d={arcPath(start, end)} stroke="var(--line)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={arcPath(start, angle)} stroke="var(--accent)" strokeWidth="6" fill="none" strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div className="t-serif" style={{ fontSize: 54, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</div>
        <div className="t-eyebrow" style={{ marginTop: 6 }}>Replova score</div>
      </div>
    </div>
  )
}
