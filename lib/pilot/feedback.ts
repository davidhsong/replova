import { isUuid } from '@/lib/playbook'
import { checked, pilotContext } from './access'
import { isoDay, localDay } from './workflow'
export type Query = Record<string, string | undefined>
type Feedback = {
  id: string
  rating: number
  comment: string
  placement: string
  created_at: string
  urgent: boolean
  themes: { name: string; excerpt: string }[]
  analysis_status: string
  sentiment: string | null
}
type Period = {
  total: number
  matches: number
  category: string | null
  related: { id: string; theme: string; quarter: string; category: string | null }[]
  ranked: { category: string; theme: string; urgent: number; n: number }[]
  rows: Feedback[]
}
export async function period(ctx: Awaited<ReturnType<typeof pilotContext>>, q: Query) {
  const l = ctx.location!
  const end = isoDay(q.end) ? q.end : localDay(l.pilot_timezone)
  const start = isoDay(q.start)
    ? q.start
    : new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10)
  const page = Math.max(0, Math.min(100000, parseInt(q.page ?? '0') || 0))
  const data: Period = checked(
    await ctx.admin.rpc('tap_issue_period', {
      p_location: l.id,
      p_start: start,
      p_end: end,
      p_source: isUuid(q.source) ? q.source : null,
      p_rating: /^[1-5]$/.test(q.rating ?? '') ? Number(q.rating) : null,
      p_test: q.test === '1',
      p_theme: q.theme || null,
      p_page: page,
      p_entry: isUuid(q.entry) ? q.entry : null,
    }),
  )
  return { data, start, end, page }
}
export function filterUrl(q: Query, changes: Query = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...q, ...changes })) if (v) params.set(k, v)
  return '/dashboard/feedback?' + params
}
