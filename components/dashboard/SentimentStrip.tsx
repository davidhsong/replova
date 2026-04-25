// 12-week sentiment heatmap. Each value is 0..1 (1 = most positive).
type Props = { data: number[] }

export default function SentimentStrip({ data }: Props) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {data.map((v, i) => {
        const isPos = v >= 0.55
        const isNeg = v < 0.35
        const color = isPos ? 'var(--pos)' : isNeg ? 'var(--neg)' : 'var(--warn)'
        const bg    = isPos ? 'var(--pos-sub)' : isNeg ? 'var(--neg-sub)' : 'var(--warn-sub)'
        return (
          <div
            key={i}
            title={`Week ${i + 1}: ${(v * 100).toFixed(0)}%`}
            style={{ flex: 1, height: 24, borderRadius: 2, background: bg, position: 'relative', overflow: 'hidden' }}
          >
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: `${v * 100}%`, background: color, opacity: 0.6,
            }} />
          </div>
        )
      })}
    </div>
  )
}
