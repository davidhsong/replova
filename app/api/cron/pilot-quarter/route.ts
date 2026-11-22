import type { NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cronAuth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { checked } from '@/lib/pilot/access'
export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return new Response('Unauthorized', { status: 401 })
  const admin = getSupabaseAdmin()
  checked(
    await admin
      .from('tap_encounters')
      .delete()
      .lt('expires_at', new Date(Date.now() - 86400000).toISOString()),
  )
  let cursor = ''
  for (;;) {
    let query = admin
      .from('restaurants')
      .select('id')
      .eq('active', true)
      .not('workspace_id', 'is', null)
      .order('id')
      .limit(100)
    if (cursor) query = query.gt('id', cursor)
    const rows = checked(await query) ?? []
    for (const row of rows)
      checked(
        await admin.rpc('tap_issue_quarter', { p_location: row.id, p_previous: true, p_test: false }),
      )
    if (rows.length < 100) break
    cursor = rows[rows.length - 1].id
  }
  return Response.json({ ok: true })
}
