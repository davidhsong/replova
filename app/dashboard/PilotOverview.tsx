import Link from 'next/link'
import { checked, pilotContext } from '@/lib/pilot/access'
import { period, filterUrl } from '@/lib/pilot/feedback'
import { statusText, type Book } from '@/lib/pilot/workflow'
import { Setup } from './PilotSetup'
export default async function PilotOverview() {
  const ctx = await pilotContext()
  const l = ctx.location
  if (!l) return <Setup name={ctx.workspace.name} />
  const [{ data }, books, urgent, placards] = await Promise.all([
    period(ctx, {}),
    ctx.admin
      .from('issue_playbooks')
      .select('*')
      .eq('location_id', l.id)
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .returns<Book[]>(),
    ctx.admin
      .from('tap_feedback')
      .select('id,comment,created_at,themes')
      .eq('location_id', l.id)
      .eq('is_test', false)
      .eq('urgent', true)
      .order('created_at', { ascending: false })
      .limit(3),
    ctx.admin
      .from('tap_placards')
      .select('id')
      .eq('location_id', l.id)
      .is('revoked_at', null)
      .limit(1),
  ])
  const items = checked(books) ?? [],
    alerts = checked(urgent) ?? [],
    top = data.ranked[0],
    ready = checked(placards)?.length
  return (
    <main id="main-content" className="pilot">
      <header>
        <small>
          {ctx.workspace.name} / {l.name}
        </small>
        <h1>Overview</h1>
        <p>What needs your attention at this location.</p>
      </header>
      <div className="pilot-overview">
        <section>
          <h2>
            {alerts.length
              ? 'Urgent feedback'
              : top
                ? 'Most mentioned issue'
                : ready
                  ? 'Your Tap is ready'
                  : 'Collect your first visit'}
          </h2>
          {alerts.map((a) => {
            const d = new Date(a.created_at).toLocaleDateString('en-CA', {
              timeZone: l.pilot_timezone,
            })
            return (
              <Link
                className="pilot-list-link"
                key={a.id}
                href={filterUrl({ location: l.id, start: d, end: d, entry: a.id }) + '#entry-' + a.id}
              >
                {a.comment || 'Open urgent feedback'}
              </Link>
            )
          })}
          {top && (
            <Link className="issue-bar" href={filterUrl({ location: l.id, theme: top.category })}>
              <strong>{top.theme}</strong>
              {top.n} of {data.total} submissions
              <meter max={data.total} value={top.n} />
            </Link>
          )}
          {!top && !alerts.length && (
            <>
              <p>
                {ready
                  ? 'Test your form, then put the placard where customers can reach it.'
                  : 'Create a Tap link and a printable QR code.'}
              </p>
              <Link className="pilot-button" href="/dashboard/tap">
                {ready ? 'Open your Tap' : 'Set up your Tap'}
              </Link>
            </>
          )}
        </section>
        <section>
          <h2>Last 30 days</h2>
          <strong className="pilot-number">{data.total}</strong>
          <p>customer submissions</p>
          <Link href="/dashboard/feedback">View feedback</Link>
        </section>
      </div>
      <section>
        <h2>Playbook activity</h2>
        {items.map((b) => (
          <Link key={b.id} className="pilot-list-link" href={'/dashboard/playbooks/' + b.id}>
            <strong>{b.theme}</strong>
            {statusText(b.state)}
            {b.state.followUp ? ' · Follow up ' + b.state.followUp : ''}
          </Link>
        ))}
        {!items.length && (
          <p>
            {top
              ? 'Review the evidence and start a quarterly plan.'
              : 'Your first plan appears once a recurring issue is saved.'}{' '}
            <Link href="/dashboard/playbooks">Open Playbooks</Link>
          </p>
        )}
      </section>
      <Link href="/dashboard/reviews">Open Google review center</Link>
    </main>
  )
}
