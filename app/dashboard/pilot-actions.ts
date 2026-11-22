'use server'
import { after } from 'next/server'
import { advanceSimulation } from '@/lib/pilot/evidenceRun'
import { isUuid } from '@/lib/playbook'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { pilotContext, checked } from '@/lib/pilot/access'
import { accountCanActivateNewLocations } from '@/lib/accountEntitlements'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import {
  isoDay,
  localDay,
  reviseLimits,
  type Book,
  type Limits,
  type RunState,
} from '@/lib/pilot/workflow'
import { transition } from '@/lib/pilot/worker'

const field = (f: FormData, k: string, max: number) =>
  String(f.get(k) ?? '')
    .trim()
    .slice(0, max)
function fail(path: string, message: string): never {
  redirect(path + '?notice=' + encodeURIComponent(message))
}
function zone(f: FormData) {
  const z = field(f, 'timezone', 100)
  try {
    new Intl.DateTimeFormat('en', { timeZone: z })
    return z
  } catch {
    fail('/dashboard/tap', 'Enter an IANA time zone such as America/Los_Angeles.')
  }
}
export async function firstLocation(f: FormData) {
  const { admin, workspace, account } = await pilotContext()
  const name = field(f, 'name', 200)
  if (name.length < 2) fail('/dashboard/tap', 'Enter the location name.')
  const active = await accountCanActivateNewLocations(account)
  const id = checked(
    await admin.rpc('tap_first_location', {
      p_workspace: workspace.id,
      p_name: name,
      p_zone: zone(f),
      p_active: active,
    }),
  )
  ;(await cookies()).set(ACTIVE_LOCATION_COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/' })
  revalidatePath('/dashboard', 'layout')
  redirect(active ? '/dashboard/tap' : '/dashboard/billing')
}
export async function attachLocation(id: string, f: FormData) {
  const { admin, account, workspace, legacyLocation } = await pilotContext()
  if (id !== legacyLocation?.id) fail('/dashboard/tap', 'Select the location again.')
  const attached = checked(
    await admin
      .from('restaurants')
      .update({ workspace_id: workspace.id, pilot_timezone: zone(f) })
      .eq('id', id)
      .eq('owner_email', account.owner_email)
      .eq('active', true)
      .is('workspace_id', null)
      .select('id')
      .maybeSingle(),
  )
  if (!attached) fail('/dashboard/tap', 'The location has changed. Select it again.')
  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard/tap')
}
export async function placardAction(locationId: string, f: FormData) {
  const { admin } = await pilotContext(locationId)
  if (f.get('action') === 'revoke') {
    checked(
      await admin
        .from('tap_placards')
        .update({ revoked_at: new Date().toISOString() })
        .eq('location_id', locationId)
        .eq('id', field(f, 'id', 36)),
    )
  } else {
    checked(
      await admin
        .from('restaurants')
        .update({ pilot_timezone: zone(f) })
        .eq('id', locationId),
    )
    checked(
      await admin
        .from('tap_placards')
        .insert({ location_id: locationId, placement: field(f, 'placement', 100) }),
    )
  }
  revalidatePath('/dashboard/tap')
}
export async function editFeedback(locationId: string, id: string, f: FormData) {
  const { admin } = await pilotContext(locationId)
  const row = checked(
    await admin
      .from('tap_feedback')
      .select('comment,analysis_status,themes')
      .eq('id', id)
      .eq('location_id', locationId)
      .maybeSingle(),
  )
  if (!row) fail('/dashboard/feedback', 'Submission unavailable.')
  if (f.get('action') === 'retry' && row.analysis_status !== 'ready') {
    checked(await admin.rpc('tap_retry_analysis', { p_location: locationId, p_id: id }))
  } else if (row.analysis_status === 'ready') {
    const names = [
      ...new Set(
        field(f, 'themes', 500)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 8)
    const themes = names.flatMap((name) => {
      const original = row.themes.filter((t: { name: string }) => t.name === name)
      return original.length ? original : [{ name: name.slice(0, 80), excerpt: row.comment }]
    })
    checked(
      await admin
        .from('tap_feedback')
        .update({ themes })
        .eq('location_id', locationId)
        .eq('id', id),
    )
  }
  revalidatePath('/dashboard/feedback')
}
export async function saveQuarter(locationId: string, f: FormData) {
  const { admin } = await pilotContext(locationId)
  const id = checked(
    await admin.rpc('tap_issue_quarter', {
      p_location: locationId,
      p_previous: f.get('previous') === '1',
      p_day: isoDay(f.get('day')) ? f.get('day') : null,
      p_test: f.get('test') === '1',
    }),
  )
  if (!id)
    fail(
      '/dashboard/playbooks',
      'There is too little feedback. A recurring issue needs two distinct submissions in the same quarter.',
    )
  redirect('/dashboard/playbooks/' + id)
}
export async function openIssue(locationId: string, f: FormData) {
  const { admin } = await pilotContext(locationId)
  const start = field(f, 'start', 10),
    end = field(f, 'end', 10)
  if (!isoDay(start) || !isoDay(end)) fail('/dashboard/feedback', 'Select a valid date range.')
  const source = field(f, 'source', 36),
    rating = field(f, 'rating', 1)
  const id = checked(
    await admin.rpc('tap_create_issue', {
      p_location: locationId,
      p_start: start,
      p_end: end,
      p_source: isUuid(source) ? source : null,
      p_rating: /^[1-5]$/.test(rating) ? Number(rating) : null,
      p_test: f.get('test') === '1',
      p_category: field(f, 'category', 100),
    }),
  )
  if (!id)
    fail('/dashboard/feedback', 'This issue has no matching submissions in the selected period.')
  after(() => advanceSimulation(id, locationId))
  redirect('/dashboard/playbooks/' + id)
}
export async function updateEvidencePlan(locationId: string, id: string, f: FormData) {
  const { admin } = await pilotContext(locationId)
  const path = '/dashboard/playbooks/' + id
  if (f.get('action') === 'verify') {
    const ok = checked(
      await admin.rpc('tap_verify_issue', {
        p_run: id,
        p_location: locationId,
        p_note: field(f, 'observation', 1400),
      }),
    )
    if (!ok)
      fail(path, 'Review the evidence and verification criteria before confirming improvement.')
  } else if (f.get('action') === 'attach') {
    checked(await admin.rpc('tap_attach_evidence', { p_run: id, p_location: locationId }))
  } else {
    const saved = checked(
      await admin
        .from('issue_playbooks')
        .update({ owner_context: field(f, 'context', 2000) })
        .eq('location_id', locationId)
        .eq('id', id)
        .not('category_id', 'is', null)
        .eq('owner_context', field(f, 'previous', 2000))
        .select('id')
        .maybeSingle(),
    )
    if (!saved) fail(path, 'The context changed. Review the latest version before saving.')
  }
  revalidatePath(path)
  redirect(path)
}
export async function changeRun(locationId: string, id: string, f: FormData) {
  const { admin, location } = await pilotContext(locationId)
  const path = '/dashboard/playbooks/' + id
  const b = checked(
    await admin
      .from('issue_playbooks')
      .select('*')
      .eq('location_id', locationId)
      .eq('id', id)
      .maybeSingle<Book>(),
  )
  if (!b || b.category_id) fail('/dashboard/playbooks', 'Playbook unavailable.')
  if (b.revision !== Number(f.get('revision')))
    fail(path, 'The Playbook changed. Review the latest activity and try again.')
  const action = field(f, 'action', 20)
  const s = b.state
  let next: RunState = { ...s }
  let reason = ''
  let due: number | null = null
  if (s.pending && !['pause', 'authorize', 'resume'].includes(action))
    fail(
      path,
      'Checking the previous provider action. You can pause or adjust limits while waiting.',
    )
  if (action === 'log') {
    const notes = field(f, 'notes', 2000)
    if (!notes || s.authorized || s.appointment)
      fail(path, 'Record the affected areas before authorizing service.')
    next = {
      ...s,
      notes,
      kind: f.get('kind') === 'internal' ? 'internal' : 'external',
      startedAt: s.startedAt ?? new Date().toISOString(),
    }
    reason = 'Owner logged affected areas and next task'
  } else if (action === 'authorize' && s.notes && s.kind === 'external') {
    const max = field(f, 'max', 16),
      from = field(f, 'from', 10),
      until = field(f, 'until', 10)
    const limits: Limits = {
      scope: field(f, 'scope', 400),
      area: field(f, 'area', 250),
      maxCents: Math.round(Number(max) * 100),
      from,
      until,
      preference: f.get('preference') === 'earliest' ? 'earliest' : 'price',
    }
    if (
      !/^\d+(\.\d{1,2})?$/.test(max) ||
      !Number.isSafeInteger(limits.maxCents) ||
      limits.maxCents < 1 ||
      !limits.scope ||
      !limits.area ||
      !isoDay(from) ||
      !isoDay(until) ||
      until < from ||
      until < localDay(location!.pilot_timezone)
    )
      fail(path, 'Enter a scope, service area, positive USD limit and valid service window.')
    const revised = reviseLimits(s, limits)
    next = revised.next
    reason = revised.reason
    if (!next.paused && !next.appointment) due = 0
  } else if (action === 'pause') {
    next.paused = true
    reason = 'Owner paused automation'
    due = s.pending ? 60000 : null
  } else if (action === 'resume' && s.authorized) {
    next.paused = false
    next.issue = undefined
    reason = 'Owner resumed automation'
    if (!s.appointment || s.change) due = 0
  } else if (
    (action === 'cancel' || action === 'reschedule') &&
    s.appointment &&
    s.authorized &&
    !s.paused &&
    !s.resolved
  ) {
    if (f.get('confirm') !== 'on') fail(path, 'Confirm the requested appointment change.')
    if (
      action === 'reschedule' &&
      (s.appointment.quote.scope !== s.limits?.scope ||
        s.appointment.quote.totalCents > s.limits.maxCents)
    )
      fail(
        path,
        'The existing service exceeds the updated authorization. Review the committed appointment.',
      )
    next.change = action
    next.issue = undefined
    reason = 'Owner requested appointment ' + action
    due = 0
  } else if (action === 'task' && s.kind === 'internal' && s.notes) {
    next.internalDone = true
    reason = 'Owner completed internal corrective task'
  } else if (action === 'verify' && (s.internalDone || s.appointment) && !s.change) {
    const follow = field(f, 'follow', 10)
    if (follow && !isoDay(follow)) fail(path, 'Enter a valid follow-up date.')
    next.resolved = f.get('resolved') === 'yes'
    next.verified = field(f, 'outcome', 1400) ||
      (next.resolved ? 'Owner marked the issue resolved.' : 'Owner marked the issue for further work.')
    next.followUp = follow || undefined
    reason = next.resolved ? 'Owner verified the fix' : 'Further work needed'
  } else if (action === 'reopen' && s.resolved) {
    next.resolved = false
    next.verified = undefined
    next.internalDone = false
    reason = 'Owner reopened the issue'
  } else fail(path, 'This action is unavailable at the current step.')
  if (s.pending) due = 60000
  if (
    !(await transition(
      b,
      next,
      {
        status: reason,
        action,
        version: next.version,
        ...(action === 'authorize' ? { limits: next.limits } : {}),
        ...(action === 'verify' ? { outcome: next.verified, followUp: next.followUp } : {}),
        ...(action === 'log' ? { notes: next.notes } : {}),
      },
      due,
    ))
  )
    fail(path, 'The Playbook changed. Review the latest activity.')
  revalidatePath(path)
  redirect(path)
}
