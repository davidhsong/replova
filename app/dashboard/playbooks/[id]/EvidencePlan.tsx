import Link from 'next/link'
import { checked, type pilotContext } from '@/lib/pilot/access'
import { filterUrl } from '@/lib/pilot/feedback'
import { localDay, type Book } from '@/lib/pilot/workflow'
import type { IssueState } from '@/lib/pilot/issueSimulation'
import { updateEvidencePlan } from '../../pilot-actions'
import FeedbackTrend from './FeedbackTrend'
import RunRefresh from '../RunRefresh'

type Evidence = {
  id: string
  at: string
  placement: string
  urgent: boolean
  rating: number
  comment: string
  details: { name: string; excerpt: string; incidentTime?: string; incidentPlace?: string }[]
}
type Report = { at: string; note: string; total: number; matches: number }
export type EvidencePlanRecord = {
  location_id: string
  category_id: string
  id: string
  theme: string
  state: IssueState
  revision: number
  simulation_due: string | null
  is_test: boolean
  snapshot: {
    evidence: Evidence[]
    timezone: string
    location: string
    total: number
    captured: string
    start: string
    endExclusive: string
  }
  added_evidence: Evidence[]
  owner_context: string
  owner_verification: Report | null
}
export function usesEvidenceWorkflow(row: Book | EvidencePlanRecord): row is EvidencePlanRecord {
  return Boolean(row.category_id)
}
const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
export default async function EvidencePlan({
  ctx,
  book: b,
  notice,
}: {
  ctx: Awaited<ReturnType<typeof pilotContext>>
  book: EvidencePlanRecord
  notice?: string
}) {
  const l = ctx.location!
  const id = b.id
  const [comparison, follow, activity] = await Promise.all([
    ctx.admin.rpc('tap_feedback_trend', { p_location: l.id, p_run: id }),
    ctx.admin.rpc('tap_issue_followup', { p_location: l.id, p_run: id }),
    ctx.admin
      .from('issue_activity')
      .select('revision,created_at,detail')
      .eq('run_id', id)
      .order('revision'),
  ])
  const s = b.state,
    snap = b.snapshot,
    f = checked(follow),
    log = checked(activity) ?? []
  const task = s.task
    ? checked(
        await ctx.admin
          .from('playbook_tasks')
          .select('title,status')
          .eq('workspace_id', ctx.workspace.id)
          .eq('id', s.task)
          .maybeSingle(),
      )
    : null
  const format = (at: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: snap.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(at))
  const act = updateEvidencePlan.bind(null, l.id, id)
  const trend = checked(comparison)
  const action =
    s.route === 'facilities'
      ? s.stage === 'completed'
        ? 'Simulated service completed. Real service completion is unconfirmed.'
        : s.stage === 'attention'
          ? 'The service simulation needs review.'
          : 'Service simulation in progress.'
      : s.route === 'safety'
        ? 'Safety report awaiting owner review.'
        : task?.status === 'done'
          ? 'Owner task marked complete.'
          : 'Owner review task open.'
  function visits(rows: Evidence[]) {
    return rows.map((e) => {
      const day = localDay(l.pilot_timezone, new Date(e.at))
      const places = [
        ...new Set(
          e.details.flatMap((d) =>
            d.incidentPlace
              ? [d.incidentPlace]
              : (d.excerpt.match(
                  /\b(?:near|beside|by|inside|outside|at|in|on) the (?:front |back |side |main |service |checkout )?(?:entrance|door|counter|desk|lobby|restroom|floor|window|register|waiting room)\b/gi,
                ) ?? []),
          ),
        ),
      ]
      const times = [
        ...new Set(
          e.details.flatMap((d) =>
            d.incidentTime
              ? [d.incidentTime]
              : (d.excerpt.match(
                  /\b(?:at \d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)|(?:on )?(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?: morning| afternoon| evening| night)?|yesterday morning|last night)\b/gi,
                ) ?? []),
          ),
        ),
      ]
      return (
        <article className="pilot-row" key={e.id}>
          <h3>
            {e.rating} / 5 {e.urgent && ' · Urgent'}
          </h3>
          {e.details.map((t, i) => (
            <div key={i}>
              <strong>{t.name}</strong>
              <blockquote>{t.excerpt}</blockquote>
            </div>
          ))}
          <p>
            {snap.location}
            <br />
            Submitted at {format(e.at)} · {snap.timezone}
            <br />
            Tap placard · {e.placement || 'Location placard'}
          </p>
          <p>
            Customer-reported incident location · {places.join(' / ') || 'Unknown'}
            <br />
            Customer-reported incident time · {times.join(' / ') || 'Unknown'}
          </p>
          <Link
            href={
              filterUrl({
                location: l.id,
                entry: e.id,
                start: day,
                end: day,
                test: b.is_test ? '1' : undefined,
              }) +
              '#entry-' +
              e.id
            }
          >
            Open source submission
          </Link>
        </article>
      )
    })
  }
  return (
    <main className="pilot evidence-plan" id="main-content">
      {b.simulation_due && <RunRefresh revision={b.revision} />}
      <header>
        <small>
          {snap.location} · {b.is_test ? 'Test Playbook' : 'Tap Playbook'}
        </small>
        <h1>{b.theme}</h1>
        <p>
          {snap.evidence.length} supporting {snap.evidence.length === 1 ? 'visit' : 'visits'} at
          creation{b.added_evidence.length > 0 && ' · ' + b.added_evidence.length + ' added'}
        </p>
        <p>
          {task?.status === 'done' ? 'Monitor new feedback and review progress.' : s.nextAction}
        </p>
      </header>
      <FeedbackTrend trend={trend} zone={snap.timezone} action={action} preview={b.is_test} />
      {notice && <p role="status">{notice}</p>}
      <section>
        <h2>Supporting visits</h2>
        <p>
          Customers reported{' '}
          {Array.from(
            new Set(snap.evidence.flatMap((e) => e.details.map((t) => t.name.toLowerCase()))),
          ).join(', ')}
          .
        </p>
        <p>
          {format(snap.evidence[snap.evidence.length - 1].at)} – {format(snap.evidence[0].at)} ·{' '}
          {snap.timezone}
        </p>
        <details open={s.route === 'safety'}>
          <summary>View details · Original evidence</summary>
          <p>
            {snap.evidence.length} of {snap.total} eligible submissions. Saved{' '}
            {format(snap.captured)}.
          </p>
          {visits(snap.evidence)}
        </details>
        {b.added_evidence.length > 0 && (
          <details>
            <summary>View details · Added evidence ({b.added_evidence.length})</summary>
            {visits(b.added_evidence)}
          </details>
        )}
        {f.new.length > 0 && (
          <details>
            <summary>View details · New supporting visits ({f.new.length})</summary>
            {visits(f.new)}
            <form action={act}>
              <button name="action" value="attach">
                Add new evidence to plan
              </button>
            </form>
          </details>
        )}
        <details>
          <summary>Owner context{b.owner_context ? ' · Saved' : ''}</summary>
          <form action={act}>
            <input type="hidden" name="previous" value={b.owner_context} />
            <label>
              Incident details or corrective work
              <textarea name="context" maxLength={2000} defaultValue={b.owner_context} />
            </label>
            <button>Save context</button>
          </form>
        </details>
      </section>
      <section>
        <h2>{s.route === 'facilities' ? 'Service simulation' : 'Owner action'}</h2>
        {log.map((entry) => (
          <details key={entry.revision} className="evidence-decision">
            <summary>View details · {entry.detail.status}</summary>
            <small>
              {format(entry.created_at)} · {snap.timezone}
            </small>
            <p>{entry.detail.summary}</p>
            {entry.revision === 0 && (
              <p>
                Based on {snap.evidence.length} original visits for {b.theme}. {s.criteria?.scope}
              </p>
            )}
            {entry.detail.stage === 'discovery' && (
              <ul>
                {s.providers?.map((p) => (
                  <li key={p.id}>
                    {p.name} · {s.criteria?.scope}
                  </li>
                ))}
              </ul>
            )}
            {(entry.detail.stage === 'quotes' || entry.detail.stage === 'selection') &&
              s.criteria && (
                <>
                  <p>
                    Simulated service budget {money(s.criteria.maxCents)} USD · {s.criteria.from}{' '}
                    through {s.criteria.until}. {s.criteria.preference}.
                  </p>
                  {(entry.detail.stage === 'selection' ? s.decisions : s.quotes)?.map((q) => (
                    <article className="pilot-row" key={q.id}>
                      <h3>
                        {q.name} · {money(q.totalCents)}
                      </h3>
                      <p>Simulation · Written quote · {q.scope}</p>
                      <p>
                        Available {q.available} · {q.exclusions}
                      </p>
                      {'reason' in q && <strong>{String(q.reason)}</strong>}
                    </article>
                  ))}
                </>
              )}
            {(entry.detail.stage === 'schedule' ||
              entry.detail.stage === 'reconcile' ||
              entry.detail.stage === 'evaluate') &&
              s.appointment && (
                <p>
                  Simulation · {s.appointment.provider} · {s.appointment.date} ·{' '}
                  {money(s.appointment.totalCents)}
                  <br />
                  {s.appointment.reference}
                </p>
              )}
          </details>
        ))}
        {task && (
          <details open>
            <summary>
              View details ·{' '}
              {s.route === 'safety' ? 'Review customer safety report' : 'Internal corrective task'}
            </summary>
            <p>
              {task.title} · {task.status.replaceAll('_', ' ')}
            </p>
            <Link href="/dashboard/playbook?view=tasks">Open team tasks</Link>
          </details>
        )}
      </section>
      {(b.owner_verification || trend.status === 'less') && (
        <section>
          <details>
            <summary>Owner confirmation{b.owner_verification ? ' · Saved' : ' (optional)'}</summary>
            {b.owner_verification && (
              <p>
                Owner verified on {format(b.owner_verification.at)} with{' '}
                {b.owner_verification.matches} of {b.owner_verification.total} follow-up visits.{' '}
                {b.owner_verification.note}
              </p>
            )}
            {trend.status === 'less' && !b.owner_verification && (
              <form action={act}>
                <label>
                  Owner observation (optional)
                  <textarea maxLength={1400} name="observation" />
                </label>
                <button name="action" value="verify">
                  I observed real corrective work and improvement
                </button>
              </form>
            )}
          </details>
        </section>
      )}
    </main>
  )
}
