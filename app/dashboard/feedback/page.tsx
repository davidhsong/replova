import Link from 'next/link'
import { getPlanLimits } from '@/lib/planLimits'
import { checked, pilotContext } from '@/lib/pilot/access'
import { period, filterUrl, type Query } from '@/lib/pilot/feedback'
import { editFeedback, saveQuarter } from '../pilot-actions'
import { Setup } from '../PilotSetup'
import { notFound } from 'next/navigation'
import { BookmarkLocation } from '../BookmarkLocation'

export default async function Feedback({ searchParams }: { searchParams: Promise<Query> }) {
  const ctx = await pilotContext()
  const l = ctx.location
  if (!l) return <Setup name={ctx.workspace.name} />
  const q = await searchParams
  if (q.location && q.location !== l.id) {
    const target = ctx.locations.find((row) => row.id === q.location)
    if (!target) notFound()
    return <BookmarkLocation id={target.id} name={target.name} />
  }
  const [{ data, start, end, page }, sources] = await Promise.all([
    period(ctx, q),
    ctx.admin
      .from('tap_placards')
      .select('id,placement')
      .eq('location_id', l.id)
      .order('created_at'),
  ])
  const issueUrl = (theme: string) =>
    filterUrl({ ...q, location: l.id, start, end }, { theme, page: undefined }) + '#evidence'
  return (
    <main id="main-content" className="pilot">
      <header>
        <small>
          {l.name} · {l.pilot_timezone}
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
          <input name="theme" defaultValue={q.theme} list="themes" />
        </label>
        <datalist id="themes">
          {data.ranked.map((t) => (
            <option key={t.theme}>{t.theme}</option>
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
      <section>
        <h2>Ranked issues</h2>
        <p>
          {data.total} submissions in this period. Each visit counts once per theme and may mention
          several themes.
        </p>
        {data.ranked.map(({ theme, n }) => (
          <Link className="issue-bar" key={theme} href={issueUrl(theme)}>
            <span>
              {theme} · {n} of {data.total} submissions
            </span>
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
        <h2>{q.theme || 'Feedback inbox'}</h2>
        <p>
          {data.matches} matching submissions · {start} to {end} · {l.name}
        </p>
        {q.theme && (
          <form action={saveQuarter.bind(null, l.id)}>
            <input type="hidden" name="test" value={q.test ?? ''} />
            <input type="hidden" name="theme" value={q.theme} />
            <input type="hidden" name="day" value={end} />
            <small>Uses this location’s feedback for the quarter containing {end}.</small>
            <button>Open Playbook for this issue</button>
          </form>
        )}
        {data.rows.map((r) => (
          <article className="pilot-row" key={r.id} id={'entry-' + r.id}>
            <small>
              {new Date(r.created_at).toLocaleString('en-US', { timeZone: l.pilot_timezone })} ·{' '}
              {r.placement || 'Location placard'}
            </small>
            <h3>
              {r.rating} / 5 {r.urgent ? ' · Urgent' : ''}
            </h3>
            <p>{r.comment || 'Rating only'}</p>
            <small>
              {r.analysis_status === 'ready'
                ? [
                    getPlanLimits(ctx.account.plan).sentiment && r.sentiment
                      ? `Comment sentiment: ${r.sentiment}`
                      : null,
                    ...r.themes.map((t) => t.name),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : r.analysis_status === 'failed'
                  ? 'Analysis failed'
                  : 'Analysis pending'}
            </small>
            {r.analysis_status === 'ready' && r.comment && (
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
            {r.analysis_status === 'failed' && (
              <form action={editFeedback.bind(null, l.id, r.id)}>
                <button name="action" value="retry">
                  Retry analysis
                </button>
              </form>
            )}
          </article>
        ))}
        <div className="pilot-links">
          {page > 0 && <Link href={filterUrl(q, { page: String(page - 1) })}>Previous page</Link>}
          {data.matches > (page + 1) * 25 && (
            <Link href={filterUrl(q, { page: String(page + 1) })}>Next page</Link>
          )}
        </div>
      </section>
    </main>
  )
}
