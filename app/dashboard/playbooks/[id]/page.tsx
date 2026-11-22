import Link from 'next/link'
import EvidencePlan, {usesEvidenceWorkflow, type EvidencePlanRecord} from './EvidencePlan'
import RunRefresh from '../RunRefresh'
import { notFound } from 'next/navigation'
import { checked, pilotContext } from '@/lib/pilot/access'
import { localDay, rankedQuotes, statusText, stepIndex, type Book } from '@/lib/pilot/workflow'
import { period } from '@/lib/pilot/feedback'
import { changeRun } from '../../pilot-actions'
import { BookmarkLocation } from '../../BookmarkLocation'
import { isUuid } from '@/lib/playbook'

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
export default async function Issue({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ notice?: string }>
}) {
  const { id } = await params
  const ctx = await pilotContext(),
    l = ctx.location
  if (!l || !isUuid(id)) notFound()
  const b = checked(
    await ctx.admin
      .from('issue_playbooks')
      .select('*')
      .eq('id', id)
      .in('location_id', ctx.locations.map((row) => row.id))
      .maybeSingle<Book | EvidencePlanRecord>(),
  )
  if (!b) notFound()
  if (b.location_id !== l.id) {
    const target = ctx.locations.find((row) => row.id === b.location_id)
    if (!target) notFound()
    return <BookmarkLocation id={target.id} name={target.name} />
  }
  if (usesEvidenceWorkflow(b)) return <EvidencePlan ctx={ctx} book={b} notice={(await searchParams).notice} />
  const s = b.state,
    snap = b.snapshot,
    step = stepIndex(s),
    today = localDay(l.pilot_timezone)
  const log = checked(
    await ctx.admin
      .from('issue_activity')
      .select('id,created_at,detail')
      .eq('run_id', id)
      .order('revision', { ascending: false }),
  )
  const since = localDay(snap.timezone, new Date(s.startedAt ?? snap.captured))
  const after = await period(ctx, {
    start: since,
    end: today,
    theme: b.theme,
    test: b.is_test ? '1' : '',
  })
  const best = rankedQuotes(s, today)[0],
    notice = (await searchParams).notice
  const act = changeRun.bind(null, l.id, id)
  const revision = <input type="hidden" name="revision" value={b.revision} />
  const control = (action: string, label: string) => (
    <form action={act}>
      {revision}
      <button name="action" value={action}>
        {label}
      </button>
    </form>
  )
  const limits = (
    <form action={act}>
      {revision}
      <label>
        Service scope
        <textarea
          name="scope"
          maxLength={400}
          defaultValue={s.limits?.scope}
          required
          placeholder="Inspect and treat the affected area"
        />
      </label>
      <label>
        Service address or area
        <input required name="area" maxLength={250} defaultValue={s.limits?.area} />
      </label>
      <label>
        Maximum all-in cost (USD)
        <input
          type="number"
          step=".01"
          min=".01"
          required
          name="max"
          defaultValue={s.limits ? s.limits.maxCents / 100 : undefined}
        />
      </label>
      <div className="pilot-pair">
        <label>
          Earliest service date
          <input type="date" name="from" required defaultValue={s.limits?.from ?? today} />
        </label>
        <label>
          Latest service date
          <input type="date" name="until" required defaultValue={s.limits?.until} />
        </label>
      </div>
      <label>
        Choose by
        <select name="preference" defaultValue={s.limits?.preference}>
          <option value="price">Lowest eligible total</option>
          <option value="earliest">Earliest eligible visit</option>
        </select>
      </label>
      <p>
        Authorize Replova to request written quotes and book one visit within these limits. Service
        dates use {snap.timezone}.
      </p>
      <button name="action" value="authorize">
        {s.limits ? 'Save updated authorization' : 'Authorize service run'}
      </button>
    </form>
  )
  const titles =
    s.kind === 'internal'
      ? ['Log what happened', 'Carry out the corrective task', 'Verify the fix']
      : [
          'Log what happened',
          'Find and compare providers',
          'Get and confirm quotes',
          'Schedule service',
          'Verify the fix',
        ]
  const compare = (
    <aside className="pilot-compare">
      <h2>Price comparison</h2>
      {!s.providers?.length && <p>Provider research appears here after authorization.</p>}
      {s.providers?.map((p) => {
        const quotes = s.quotes?.filter((q) => q.provider === p.id) ?? []
        return (
          <article className="pilot-row" key={p.id}>
            <h3>
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.name}
              </a>
            </h3>
            <p>
              {p.fit} · {p.area}
            </p>
            <small>{p.estimate || 'No published estimate'}</small>
            {quotes.length ? (
              quotes.map((q) => (
                <div key={q.id}>
                  <strong>{money(q.totalCents)} · Written quote</strong>
                  <p>
                    {q.date} · {q.scope}
                  </p>
                  <p>
                    {q.terms} · {q.reference}
                  </p>
                  {best?.id === q.id && <b>Recommended · {s.comparison}</b>}
                </div>
              ))
            ) : (
              <p>{s.contacted?.includes(p.id) ? 'Written quote pending' : 'Awaiting outreach'}</p>
            )}
          </article>
        )
      })}
    </aside>
  )
  return (
    <main className="pilot" id="main-content">
      {(s.pending ||
        (s.authorized && !s.issue && !s.paused && !s.resolved && (!s.appointment || s.change))) && (
        <RunRefresh revision={b.revision} />
      )}
      <header>
        <small>
          {b.is_test ? 'Test Playbook · Simulated providers · ' : ''}
          {l.name} · {b.focus ? 'Issue plan' : 'Quarterly plan'} · Quarter starting{' '}
          {b.quarter_start}
        </small>
        <h1>{b.theme}</h1>
        <p>
          {snap.evidence.length} of {snap.total} submissions mentioned this issue. {statusText(s)}.
        </p>
      </header>
      {notice && <p role="alert">{notice}</p>}
      <details>
        <summary>View supporting evidence</summary>
        <p>
          {snap.start} to {snap.captured.slice(0, 10)} · {snap.timezone} · Saved snapshot
        </p>
        {snap.evidence.map((e) => (
          <blockquote key={e.id}>
            {e.excerpt}
            <small>{localDay(snap.timezone, new Date(e.at))}</small>
          </blockquote>
        ))}
      </details>
      <div className="pilot-links">
        {s.authorized &&
          !s.resolved &&
          (s.paused || s.issue
            ? control('resume', 'Resume workflow')
            : control('pause', 'Pause workflow'))}
        {s.limits && !s.resolved && (
          <details>
            <summary>Edit authorized limits</summary>
            {limits}
          </details>
        )}
      </div>
      <div className="pilot-plan">
        <div>
          {titles.map((title, i) => {
            const index = s.kind === 'internal' && i === 2 ? 4 : i
            return (
              <div key={title}>
                <details className="pilot-step" open={index === step}>
                  <summary>
                    <span>{i + 1}</span>
                    <strong>{title}</strong>
                    <small>{index === step ? 'Current step' : 'View details'}</small>
                  </summary>
                  {index === 0 && (
                    <>
                      {s.notes && <p>{s.notes}</p>}
                      {!s.authorized && !s.internalDone && (
                        <form action={act}>
                          {revision}
                          <label>
                            What happened and where?
                            <textarea
                              required
                              name="notes"
                              defaultValue={s.notes}
                              maxLength={2000}
                            />
                          </label>
                          <label>
                            How will you handle it?
                            <select
                              name="kind"
                              defaultValue={
                                s.kind ??
                                (/pest|hygiene|equipment|repair/i.test(b.theme)
                                  ? 'external'
                                  : 'internal')
                              }
                            >
                              <option value="external">Find an outside provider</option>
                              <option value="internal">Internal corrective task</option>
                            </select>
                          </label>
                          <button name="action" value="log">
                            Save incident
                          </button>
                        </form>
                      )}
                    </>
                  )}
                  {index === 1 && s.kind === 'internal' && (
                    <>
                      <p>
                        Carry out the action recorded in the incident notes and check the affected
                        area.
                      </p>
                      {!s.internalDone && control('task', 'Mark task complete')}
                    </>
                  )}
                  {index === 1 && s.kind !== 'internal' && (
                    <>
                      {!s.notes ? (
                        <p>Record the incident first.</p>
                      ) : !s.limits ? (
                        limits
                      ) : (
                        <p>
                          {s.providers?.length ?? 0} local options found for {s.limits.scope} near{' '}
                          {s.limits.area}.
                        </p>
                      )}
                    </>
                  )}
                  {index === 2 && (
                    <p>
                      {s.contacted?.length ?? 0} providers contacted.{' '}
                      {s.quotesComplete
                        ? 'Written quote comparison complete.'
                        : 'Waiting for comparable written terms and availability.'}
                    </p>
                  )}
                  {index === 3 && (
                    <>
                      {s.appointment ? (
                        <>
                          <strong>Booking confirmed</strong>
                          <p>
                            {s.appointment.date} · {money(s.appointment.quote.totalCents)} ·
                            Provider confirmation {s.appointment.reference}
                          </p>
                          {!s.resolved && (
                            <details>
                              <summary>Change appointment</summary>
                              <form action={act}>
                                {revision}
                                <label>
                                  <input type="checkbox" required name="confirm" /> I authorize this
                                  appointment change within the saved limits.
                                </label>
                                <button name="action" value="reschedule">
                                  Request reschedule
                                </button>
                                <button name="action" value="cancel">
                                  Request cancellation
                                </button>
                              </form>
                            </details>
                          )}
                        </>
                      ) : (
                        <p>
                          {s.issue ||
                            'A provider must confirm the exact quote and appointment before a booking appears here.'}
                        </p>
                      )}
                    </>
                  )}
                  {index === 4 && (
                    <>
                      <p>
                        Since {since}, {after.data.matches} of {after.data.total} submissions
                        mention this issue. The saved quarter had {snap.evidence.length} of{' '}
                        {snap.total}.
                      </p>
                      {s.verified && (
                        <p>
                          {s.verified} {s.followUp && 'Follow up ' + s.followUp}
                        </p>
                      )}
                      {s.resolved ? (
                        control('reopen', 'Reopen issue')
                      ) : s.appointment || s.internalDone ? (
                        <form action={act}>
                          {revision}
                          <label>
                            What did you observe?
                            <textarea name="outcome" required maxLength={1400} />
                          </label>
                          <label>
                            Result
                            <select name="resolved">
                              <option value="yes">Issue resolved</option>
                              <option value="no">Needs more work</option>
                            </select>
                          </label>
                          <label>
                            Follow-up date (optional)
                            <input name="follow" type="date" />
                          </label>
                          <button name="action" value="verify">
                            Save verification
                          </button>
                        </form>
                      ) : (
                        <p>
                          Complete the corrective task or confirm the service appointment first.
                        </p>
                      )}
                    </>
                  )}
                </details>
                {index === step && s.kind !== 'internal' && (
                  <div className="pilot-mobile-compare">{compare}</div>
                )}
              </div>
            )
          })}
        </div>
        {s.kind !== 'internal' && <div className="pilot-desktop-compare">{compare}</div>}
      </div>
      <details>
        <summary>View details and provider activity</summary>
        {!log?.length && <p>No actions recorded yet.</p>}
        {log?.map((a) => (
          <article className="pilot-row" key={a.id}>
            <small>
              {new Date(a.created_at).toLocaleString('en-US', { timeZone: snap.timezone })}
            </small>
            <h3>{a.detail.status}</h3>
            <p>{a.detail.receipt?.message || a.detail.request?.scope || ''}</p>
            {a.detail.receipt?.reference && (
              <small>Provider reference {a.detail.receipt.reference}</small>
            )}
            <details>
              <summary>View recorded data</summary>
              <pre>{JSON.stringify(a.detail, null, 2)}</pre>
            </details>
          </article>
        ))}
      </details>
      <div className="pilot-links">
        <Link href="/dashboard/playbooks">All Playbooks</Link>
        <Link href="/dashboard/settings/providers">Provider integrations</Link>
      </div>
    </main>
  )
}
