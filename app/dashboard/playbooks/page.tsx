import Link from 'next/link'
import { checked, pilotContext } from '@/lib/pilot/access'
import { statusText, type Book } from '@/lib/pilot/workflow'
import { saveQuarter } from '../pilot-actions'
import { Setup } from '../PilotSetup'
export default async function Playbooks({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { admin, workspace, location: l } = await pilotContext()
  if (!l) return <Setup name={workspace.name} />
  const books = checked(
    await admin
      .from('issue_playbooks')
      .select('*')
      .eq('location_id', l.id)
      .order('created_at', { ascending: false })
      .returns<Book[]>(),
  )
  const q = await searchParams
  return (
    <main className="pilot" id="main-content">
      <header>
        <small>
          {l.name} · {l.pilot_timezone}
        </small>
        <h1>Playbooks</h1>
        <p>
          Work on the most urgent recurring issue for each quarter. Each plan keeps the evidence
          used to choose it.
        </p>
      </header>
      {q.notice && <p role="status">{q.notice}</p>}
      <section>
        <h2>Quarterly plan</h2>
        <p>
          A pattern needs at least two separate visits mentioning the same issue. Urgent recurring
          issues come first, followed by frequency.
        </p>
        <form action={saveQuarter.bind(null, l.id)}>
          <button>Start this quarter’s Playbook</button>
        </form>
      </section>
      {books?.map((b) => (
        <Link className="pilot-list-link" href={'/dashboard/playbooks/' + b.id} key={b.id}>
          <small>
            {b.is_test ? 'Test Playbook · ' : ''}
            {b.focus ? 'Issue plan' : 'Quarterly plan'} · Quarter starting {b.quarter_start}
          </small>
          <strong>{b.theme}</strong>
          <span>{statusText(b.state)}</span>
        </Link>
      ))}
      <details>
        <summary>Test the workflow</summary>
        <p>
          Submit and analyze two test visits with a shared issue. Test Playbooks use simulated
          providers for every step.
        </p>
        <form action={saveQuarter.bind(null, l.id)}>
          <button name="test" value="1">
            Start a test Playbook
          </button>
        </form>
      </details>
      <Link href="/dashboard/playbook">Procedure library and team tasks</Link>
    </main>
  )
}
