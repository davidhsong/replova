import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checked } from './access'
import { simulationStep, type IssueState } from './issueSimulation'

export async function advanceSimulation(id: string, location: string) {
  const admin = getSupabaseAdmin()
  for (let i = 0; i < 5; i++) {
    const row = checked(
      await admin
        .from('issue_playbooks')
        .select('id,revision,state')
        .eq('location_id', location)
        .eq('id', id)
        .not('category_id', 'is', null)
        .not('simulation_due', 'is', null)
        .maybeSingle(),
    )
    if (!row) return
    const result = simulationStep(row.id, row.state as IssueState)
    if (!result) return
    const saved = checked(
      await admin.rpc('tap_simulation_transition', {
        p_location: location,
        p_run: id,
        p_revision: row.revision,
        p_state: result.state,
        p_detail: { status: result.status, summary: result.summary, stage: row.state.stage },
      }),
    )
    if (!saved || result.state.stage === 'reconcile') return
  }
}
