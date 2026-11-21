import 'server-only'
import { executeRun } from './executeRun'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checked } from './access'
import { liveAdapter } from './providers'
import { testAdapter } from './testAdapter'
import { type Book, type RunState } from './workflow'

export async function transition(
  b: Book,
  state: RunState,
  detail: Record<string, unknown>,
  delay: number | null = null,
) {
  return (
    checked(
      await getSupabaseAdmin().rpc('issue_transition', {
        p_run: b.id,
        p_location: b.location_id,
        p_revision: b.revision,
        p_state: state,
        p_detail: detail,
        p_due: delay === null ? null : new Date(Date.now() + delay).toISOString(),
      }),
    ) === true
  )
}
async function read(id: string) {
  return checked(
    await getSupabaseAdmin().from('issue_playbooks').select('*').eq('id', id).maybeSingle<Book>(),
  )
}
export async function advance(book: Book) {
  return executeRun(book, book.is_test ? testAdapter : liveAdapter, read, transition)
}
