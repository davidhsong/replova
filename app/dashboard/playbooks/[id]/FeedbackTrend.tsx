type Trend = {
  baselineStart: string
  baselineEnd: string
  baselineMatches: number
  baselineTotal: number
  completedAt: string | null
  start: string
  evaluated: string
  matches: number
  total: number
  pending: number
  status: 'waiting' | 'less' | 'no_decrease'
}
const labels = {
  waiting: 'Awaiting more feedback',
  less: 'Reported less often',
  no_decrease: 'No decrease observed',
}
function visits(matches: number, total: number) {
  const share = total
    ? ' (' +
      new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 }).format(
        matches / total,
      ) +
      ')'
    : ''
  return `${matches} of ${total} visits${share}`
}
export default function FeedbackTrend({
  trend,
  zone,
  action,
  preview,
}: {
  trend: Trend
  zone: string
  action: string
  preview: boolean
}) {
  const format = (at: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(at))
  return (
    <section aria-label="Playbook follow-up">
      <h2>Action record</h2>
      <p>
        {trend.completedAt
          ? `The owner task was marked complete on ${format(trend.completedAt)}.`
          : action}
      </p>
      <h2>Customer feedback</h2>
      <strong>{labels[trend.status]}</strong>
      <p>
        {trend.completedAt ? 'Since the owner task was completed' : 'Since this Playbook opened'},{' '}
        {visits(trend.matches, trend.total)} mentioned this issue. The baseline was{' '}
        {visits(trend.baselineMatches, trend.baselineTotal)}.
      </p>
      <details>
        <summary>View details · Feedback comparison</summary>
        <p>
          Baseline · {format(trend.baselineStart)} to {format(trend.baselineEnd)} ·{' '}
          {visits(trend.baselineMatches, trend.baselineTotal)} mentioned this issue.
        </p>
        <p>
          Follow-up · {format(trend.start)} to {format(trend.evaluated)} ·{' '}
          {visits(trend.matches, trend.total)} mentioned this issue. {trend.pending} awaiting
          analysis.
        </p>
        <p>
          After seven full days, compare the share of visits mentioning this issue at this location.
          Both periods need at least five eligible visits and all follow-up analysis must be
          complete. A lower share counts as reported less often. An equal or higher share counts as
          no decrease.
        </p>
        {preview && <p>This preview is excluded from customer trends.</p>}
        <small>
          Evaluated {format(trend.evaluated)} · {zone}
        </small>
      </details>
    </section>
  )
}
