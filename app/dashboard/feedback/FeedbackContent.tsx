import FeedbackFlow from '@/components/dashboard/FeedbackFlow'
import { flowKey, flowLabels, flowParent } from '@/lib/pilot/flow'
import Link from 'next/link'
import { getPlanLimits, type Plan } from '@/lib/planLimits'
import { checked } from '@/lib/pilot/access'
import { period, filterUrl, type Query } from '@/lib/pilot/feedback'
import { editFeedback, openIssue } from '../pilot-actions'

import type { getSupabaseAdmin } from '@/lib/supabase'
export default async function FeedbackContent({
  admin,
  location: l,
  q,
  plan,
  demo = false,
}: {
  admin: ReturnType<typeof getSupabaseAdmin>
  location: { id: string; name: string; pilot_timezone: string }
  q: Query
  plan: Plan
  demo?: boolean
}) {
  const [{ data, start, end, page }, sources, activation] = await Promise.all([
    period({ admin, location: l }, q),
    admin.from('tap_placards').select('id,placement').eq('location_id', l.id).order('created_at'),
    admin
      .from('tap_analysis_locations')
      .select('enabled_from,remaining_claims')
      .eq('location_id', l.id)
      .maybeSingle(),
  ])
  function url(query: Query, changes: Query) {
    const href = filterUrl(query, changes)
    return demo ? href.replace('/dashboard/feedback', '/preview/feedback') : href
  }
  const scope = checked(activation)
  const scheduled = (createdAt: string) =>
    scope && scope.remaining_claims !== 0 && Date.parse(createdAt) >= Date.parse(scope.enabled_from)
  const issueUrl = (theme: string) =>
    url(
      { ...q, location: l.id, start, end },
      { theme, flow: undefined, page: undefined, entry: undefined },
    ) + '#evidence'
  const group = flowKey(q.flow)
  const query = { ...q, location: l.id, start, end }
  const label = data.ranked.find((r) => r.category === data.category)?.theme ?? q.theme
  const quarter =
    end.slice(0, 4) +
    '-' +
    String(1 + 3 * Math.floor((Number(end.slice(5, 7)) - 1) / 3)).padStart(2, '0') +
    '-01'
  const existing = data.related.find((b) => b.category === data.category && b.quarter === quarter)
  return (
    <main id="main-content" className="pilot">
      <header>
        <small>
          {demo && 'Demo workspace · '}{l.name} · {l.pilot_timezone}
        </small>
        <h1>{q.test === '1' ? 'Test feedback' : 'Feedback'}</h1>
        <p>
          {q.test === '1'
            ? 'These submissions are excluded from location metrics.'
            : 'Private feedback from visits to this location.'}
        </p>
      </header>
      <form className="pilot-filters" method="get">
        <input type="hidden" name="location" value={l.id} />
        <label>
          From
          <input type="date" name="start" defaultValue={start} />
        </label>
        <label>
          Through
          <input type="date" name="end" defaultValue={end} />
        </label>
        <label>
          Placard
          <select name="source" defaultValue={q.source}>
            <option value="">All placements</option>
            {checked(sources)?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.placement || 'Location placard'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rating
          <select name="rating" defaultValue={q.rating}>
            <option value="">All ratings</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Theme
          <input
            name="theme"
            defaultValue={label?.startsWith('Other ? ') ? q.theme : label}
            list="themes"
          />
        </label>
        <datalist id="themes">
          {data.ranked.map((t) => (
            <option key={t.category} value={t.category}>
              {t.theme}
            </option>
          ))}
        </datalist>
        <label>
          Feedback type
          <select name="test" defaultValue={q.test}>
            <option value="">Customer visits</option>
            <option value="1">Test submissions</option>
          </select>
        </label>
        <button>Apply filters</button>
      </form>
      <FeedbackFlow leaves={data.leaves} base={url(query, { flow: undefined, page: undefined })} />
      <section>
        <h2>Ranked issues</h2>
        <p>
          {data.total} submissions in this period. Each visit counts once per issue and may mention
          several issues.
        </p>
        {data.ranked.map(({ theme, category, n, urgent }) => (
          <Link className="issue-bar" key={theme} href={issueUrl(category)}>
            <span>
              {theme} · {n} of {data.total} submissions
            </span>
            {urgent > 0 && <small>{urgent} urgent</small>}
            <meter aria-label={theme} value={n} max={data.total} />
          </Link>
        ))}
        {!data.ranked.length && (
          <p>
            {data.total
              ? 'Themes appear after comments have been analyzed.'
              : 'No submissions match these filters.'}{' '}
            <Link href="/dashboard/tap">Set up your Tap</Link>
          </p>
        )}
      </section>
      <section id="evidence">
        {group && flowParent[group] && (
          <small>{flowLabels[flowParent[group]!] + ' → ' + flowLabels[group]}</small>
        )}
        <h2>{group ? flowLabels[group] : label || 'Feedback inbox'}</h2>
        <p>
          {data.matches} matching submissions · {start} to {end} · {l.name}
        </p>
        {group && (
          <Link href={url(query, { flow: undefined, page: undefined }) + '#feedback-flow'}>
            Back to feedback flow
          </Link>
        )}
        {!demo &&
          q.theme &&
          !group &&
          data.matches > 0 &&
          (existing ? (
            <Link className="pilot-button" href={'/dashboard/playbooks/' + existing.id}>
              Open Playbook
            </Link>
          ) : (
            <form action={openIssue.bind(null, l.id)}>
              {Object.entries({
                category: data.category,
                start,
                end,
                source: q.source,
                rating: q.rating,
                test: q.test,
              }).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v ?? ''} />
              ))}
              <button>Create Playbook</button>
            </form>
          ))}
        {!demo && data.related.some((b) => b.id !== existing?.id) && (
          <details>
            <summary>Related saved Playbooks</summary>
            {data.related
              .filter((b) => b.id !== existing?.id)
              .map((b) => (
                <Link className="pilot-list-link" key={b.id} href={'/dashboard/playbooks/' + b.id}>
                  {b.theme} ? Quarter starting {b.quarter}
                </Link>
              ))}
          </details>
        )}
        {data.rows.map((r) => (
          <article className="pilot-row" key={r.id} id={'entry-' + r.id}>
            <small>
              Submitted at{' '}
              {new Date(r.created_at).toLocaleString('en-US', { timeZone: l.pilot_timezone })} · Tap
              placard ? {r.placement || 'Location placard'}
            </small>
            <h3>
              {r.rating} / 5 {r.urgent ? ' · Urgent' : ''}
            </h3>
            <p>{r.comment || 'Rating only'}</p>
            <small>
              {r.analysis_status === 'ready'
                ? [
                    getPlanLimits(plan).sentiment && r.sentiment
                      ? `Comment sentiment: ${r.sentiment}`
                      : null,
                    ...r.themes.map((t) => t.name),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : r.analysis_status === 'working' &&
                    scope &&
                    Date.parse(r.created_at) >= Date.parse(scope.enabled_from)
                  ? 'Saved · analysis in progress'
                  : !scheduled(r.created_at)
                    ? 'Saved · analysis not scheduled'
                    : r.analysis_status === 'failed'
                      ? 'Analysis failed'
                      : 'Analysis pending'}
            </small>
            {!demo && r.analysis_status === 'ready' && r.comment && (
              <details>
                <summary>Correct themes</summary>
                <form action={editFeedback.bind(null, l.id, r.id)}>
                  <label>
                    Themes, separated by commas
                    <input name="themes" defaultValue={r.themes.map((t) => t.name).join(', ')} />
                  </label>
                  <button>Save correction</button>
                </form>
              </details>
            )}
            {!demo && r.analysis_status === 'failed' && scheduled(r.created_at) && (
              <form action={editFeedback.bind(null, l.id, r.id)}>
                <button name="action" value="retry">
                  Retry analysis
                </button>
              </form>
            )}
          </article>
        ))}
        <div className="pilot-links">
          {page > 0 && <Link href={url(q, { page: String(page - 1) })}>Previous page</Link>}
          {data.matches > (page + 1) * 25 && (
            <Link href={url(q, { page: String(page + 1) })}>Next page</Link>
          )}
        </div>
      </section>
    </main>
  )
}
