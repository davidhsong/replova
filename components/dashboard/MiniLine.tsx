type Props = {
  data: number[]
  w?: number
  h?: number
  color?: string
  stroke?: number
  fill?: boolean
}

export default function MiniLine({ data, w = 120, h = 28, color = 'var(--t1)', stroke = 1.5, fill = false }: Props) {
  if (data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const pad = 2
  const range = (max - min) || 1
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return [x, y]
  })
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && (
        <path
          d={`${d} L${w - pad} ${h - pad} L${pad} ${h - pad} Z`}
          fill={color} opacity="0.08"
        />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
