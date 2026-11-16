import type { ReactNode } from 'react'
import styles from './DashboardMetrics.module.css'

export type MetricTone = 'neutral' | 'positive' | 'warning' | 'negative'

export type MetricMeter = {
  value: number
  max: number
  reference?: number
  label: string
  tone?: MetricTone
}

export type MetricDelta = {
  value: string
  label: string
  tone: MetricTone
}

type SummaryCardProps = {
  label: string
  value: string
  description: string
  help: string
  tone?: MetricTone
  delta?: MetricDelta
  meter?: MetricMeter
}

export type MetricComparisonRow = {
  label: string
  value: string
  help: string
  detail: string
  delta?: MetricDelta
  meter?: MetricMeter
}

function clampPercentage(value: number, max: number) {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

function MetricHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className={styles.help} tabIndex={0} aria-label={`${label}: ${String(children)}`}>
      <span aria-hidden="true">?</span>
      <span role="tooltip">{children}</span>
    </span>
  )
}

function ComparisonMeter({ value, max, reference, label, tone = 'neutral' }: MetricMeter) {
  const valuePosition = clampPercentage(value, max)
  const referencePosition = reference === undefined ? 0 : clampPercentage(reference, max)
  const segmentStart = Math.min(valuePosition, referencePosition)
  const segmentWidth = reference === undefined
    ? valuePosition
    : Math.abs(valuePosition - referencePosition)

  if (max <= 0) {
    return <span className={styles.noComparison}>Not enough data</span>
  }

  return (
    <span
      className={styles.meter}
      data-tone={tone}
      role="img"
      aria-label={label}
      style={{
        '--meter-value': `${valuePosition}%`,
        '--meter-reference': `${referencePosition}%`,
        '--meter-start': `${segmentStart}%`,
        '--meter-width': `${segmentWidth}%`,
      } as React.CSSProperties}
    >
      <span className={styles.meterTrack} aria-hidden="true">
        <span className={styles.meterSegment} />
        {reference !== undefined ? <span className={styles.referenceMarker} /> : null}
        <span className={styles.valueMarker} />
      </span>
    </span>
  )
}

function Delta({ value, label, tone }: MetricDelta) {
  return (
    <span className={styles.delta} data-tone={tone} title={label}>
      {value}
    </span>
  )
}

export function MetricSummaryGrid({ children }: { children: ReactNode }) {
  return (
    <section className={styles.summaryGrid} aria-label="Feedback operations metrics">
      {children}
    </section>
  )
}

export function MetricSummaryCard({
  label,
  value,
  description,
  help,
  tone = 'neutral',
  delta,
  meter,
}: SummaryCardProps) {
  return (
    <article className={styles.summaryCard} data-tone={tone}>
      <div className={styles.summaryLabel}>
        <span>{label}</span>
        <MetricHelp label={label}>{help}</MetricHelp>
      </div>
      <div className={styles.summaryValue}>
        <strong>{value}</strong>
        {delta ? <Delta {...delta} /> : null}
      </div>
      <small>{description}</small>
      {meter ? <ComparisonMeter {...meter} /> : null}
    </article>
  )
}

export function MetricComparisonTable({ rows }: { rows: readonly MetricComparisonRow[] }) {
  return (
    <section className={styles.comparisonCard} aria-labelledby="feedback-metric-comparison">
      <header>
        <div>
          <span>Current operations</span>
          <h2 id="feedback-metric-comparison">Metric comparison</h2>
        </div>
        <small>Calculated from demo records</small>
      </header>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Current</th>
              <th scope="col">Comparison</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label}>
                <th scope="row">
                  <span>{row.label}</span>
                  <MetricHelp label={row.label}>{row.help}</MetricHelp>
                </th>
                <td>
                  <strong>{row.value}</strong>
                  <small>{row.detail}</small>
                </td>
                <td>
                  {row.delta ? <Delta {...row.delta} /> : null}
                  {row.meter ? <ComparisonMeter {...row.meter} /> : null}
                  {!row.delta && !row.meter ? <span className={styles.noComparison}>Current value only</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
