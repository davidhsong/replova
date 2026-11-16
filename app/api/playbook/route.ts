import { NextRequest, NextResponse } from 'next/server'
import { authorizePlaybookRequest } from '@/lib/playbookAccess'
import { loadPlaybookState } from '@/lib/playbookData'
import {
  cleanPlaybookText,
  isUuid,
  parsePriority,
  parseProcedureSnapshot,
  parseTaskStatus,
} from '@/lib/playbook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ACTIONS = new Set([
  'role.create', 'role.update', 'person.create', 'person.update',
  'procedure.create', 'procedure.update', 'proposal.review', 'proposal.apply',
  'task.create', 'task.update',
])

async function existsInWorkspace(
  admin: ReturnType<typeof import('@/lib/supabase').getSupabaseAdmin>,
  table: string,
  workspaceId: string,
  id: unknown,
) {
  if (!isUuid(id)) return false
  const { data, error } = await admin.from(table).select('id').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
  if (error) throw error
  return Boolean(data)
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('conflict') || message.includes('40001')) {
    return NextResponse.json({ error: 'This record changed in another request. Reload and try again.' }, { status: 409 })
  }
  if (message.includes('duplicate') || message.includes('23505')) {
    return NextResponse.json({ error: 'That record already exists.' }, { status: 409 })
  }
  if (message.includes('invalid_') || message.includes('not_found') || message.includes('not found') || message.includes('required')) {
    return NextResponse.json({ error: message.replace(/^.*playbook_/, '').replaceAll('_', ' ') }, { status: 400 })
  }
  console.error('[Playbook] Mutation failed:', message)
  return NextResponse.json({ error: 'Unable to save this Playbook change.' }, { status: 500 })
}

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')
  const access = await authorizePlaybookRequest(request, workspaceId)
  if (!access.ok) return access.response
  try {
    const state = await loadPlaybookState(access.context.admin, access.context.workspace.id)
    return NextResponse.json({ state }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[Playbook] State load failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Unable to load Playbook.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 70_000) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 })
  }
  let body: { workspaceId?: unknown; action?: unknown; payload?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (typeof body.action !== 'string' || !ACTIONS.has(body.action) || !body.payload || typeof body.payload !== 'object') {
    return NextResponse.json({ error: 'Invalid Playbook action.' }, { status: 400 })
  }
  const access = await authorizePlaybookRequest(request, body.workspaceId, { mutation: true })
  if (!access.ok) return access.response
  const { admin, user, workspace } = access.context
  const payload = body.payload as Record<string, unknown>

  try {
    if (body.action === 'role.create') {
      const name = cleanPlaybookText(payload.name, 120)
      const department = cleanPlaybookText(payload.department, 100)
      if (name.length < 2 || department.length < 2) throw new Error('Role name and department are required.')
      const { error } = await admin.from('playbook_roles').insert({
        workspace_id: workspace.id, name, department,
        responsibilities: cleanPlaybookText(payload.responsibilities, 2000), created_by: user.id,
      })
      if (error) throw error
    } else if (body.action === 'role.update') {
      if (!isUuid(payload.id)) throw new Error('Role not found.')
      const changes: Record<string, unknown> = {}
      if ('name' in payload) changes.name = cleanPlaybookText(payload.name, 120)
      if ('department' in payload) changes.department = cleanPlaybookText(payload.department, 100)
      if ('responsibilities' in payload) changes.responsibilities = cleanPlaybookText(payload.responsibilities, 2000)
      if (typeof payload.active === 'boolean') changes.active = payload.active
      if (Object.keys(changes).length === 0) throw new Error('No role changes supplied.')
      const { data, error } = await admin.from('playbook_roles').update(changes).eq('workspace_id', workspace.id).eq('id', payload.id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Role not found.')
    } else if (body.action === 'person.create') {
      const displayName = cleanPlaybookText(payload.display_name, 120)
      const jobTitle = cleanPlaybookText(payload.job_title, 120)
      const department = cleanPlaybookText(payload.department, 100)
      if (displayName.length < 2 || jobTitle.length < 2 || department.length < 2) throw new Error('Name, job title, and department are required.')
      const roleId = payload.role_id === null || payload.role_id === '' ? null : payload.role_id
      if (roleId !== null && !await existsInWorkspace(admin, 'playbook_roles', workspace.id, roleId)) throw new Error('Role not found.')
      const { error } = await admin.from('playbook_people').insert({
        workspace_id: workspace.id, display_name: displayName, job_title: jobTitle, department,
        responsibilities: cleanPlaybookText(payload.responsibilities, 2000), role_id: roleId, created_by: user.id,
      })
      if (error) throw error
    } else if (body.action === 'person.update') {
      if (!isUuid(payload.id)) throw new Error('Employee not found.')
      const changes: Record<string, unknown> = {}
      if ('display_name' in payload) changes.display_name = cleanPlaybookText(payload.display_name, 120)
      if ('job_title' in payload) changes.job_title = cleanPlaybookText(payload.job_title, 120)
      if ('department' in payload) changes.department = cleanPlaybookText(payload.department, 100)
      if ('responsibilities' in payload) changes.responsibilities = cleanPlaybookText(payload.responsibilities, 2000)
      if ('role_id' in payload) {
        const roleId = payload.role_id === null || payload.role_id === '' ? null : payload.role_id
        if (roleId !== null && !await existsInWorkspace(admin, 'playbook_roles', workspace.id, roleId)) throw new Error('Role not found.')
        changes.role_id = roleId
      }
      if (typeof payload.active === 'boolean') changes.active = payload.active
      const { data, error } = await admin.from('playbook_people').update(changes).eq('workspace_id', workspace.id).eq('id', payload.id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Employee not found.')
    } else if (body.action === 'procedure.create') {
      const snapshot = parseProcedureSnapshot(payload.snapshot)
      const { error } = await admin.rpc('playbook_create_procedure', {
        p_workspace_id: workspace.id, p_actor_id: user.id, p_snapshot: snapshot,
        p_change_summary: cleanPlaybookText(payload.change_summary, 1000) || 'Initial procedure',
      })
      if (error) throw error
    } else if (body.action === 'procedure.update') {
      if (!isUuid(payload.id) || !Number.isInteger(payload.expected_lock_version)) throw new Error('Invalid procedure update.')
      const snapshot = parseProcedureSnapshot(payload.snapshot)
      const { error } = await admin.rpc('playbook_update_procedure', {
        p_workspace_id: workspace.id, p_procedure_id: payload.id,
        p_expected_lock_version: payload.expected_lock_version, p_actor_id: user.id,
        p_snapshot: snapshot, p_change_summary: cleanPlaybookText(payload.change_summary, 1000),
      })
      if (error) throw error
    } else if (body.action === 'proposal.review') {
      if (!isUuid(payload.id) || !Number.isInteger(payload.expected_lock_version)) throw new Error('Invalid proposal update.')
      const reviewAction = payload.review_action
      if (!['edit', 'approve', 'reject'].includes(String(reviewAction))) throw new Error('Invalid proposal action.')
      let edits: Record<string, unknown> | null = null
      if (reviewAction === 'edit') {
        if (!payload.edits || typeof payload.edits !== 'object') throw new Error('Proposal edits are required.')
        const source = payload.edits as Record<string, unknown>
        edits = {
          problem: cleanPlaybookText(source.problem, 2000),
          expected_benefit: cleanPlaybookText(source.expected_benefit, 1200),
          rationale: cleanPlaybookText(source.rationale, 2000),
          priority: parsePriority(source.priority),
          proposed_snapshot: parseProcedureSnapshot(source.proposed_snapshot),
          suggested_role_id: source.suggested_role_id === '' ? null : source.suggested_role_id,
        }
        if (edits.suggested_role_id !== null && !await existsInWorkspace(admin, 'playbook_roles', workspace.id, edits.suggested_role_id)) throw new Error('Role not found.')
      }
      const { error } = await admin.rpc('playbook_review_proposal', {
        p_workspace_id: workspace.id, p_proposal_id: payload.id,
        p_expected_lock_version: payload.expected_lock_version, p_actor_id: user.id,
        p_action: reviewAction, p_edits: edits,
      })
      if (error) throw error
    } else if (body.action === 'proposal.apply') {
      if (!isUuid(payload.id) || !Number.isInteger(payload.expected_lock_version)) throw new Error('Invalid proposal update.')
      const { error } = await admin.rpc('playbook_apply_proposal', {
        p_workspace_id: workspace.id, p_proposal_id: payload.id,
        p_expected_proposal_lock_version: payload.expected_lock_version,
        p_expected_procedure_lock_version: Number.isInteger(payload.expected_procedure_lock_version) ? payload.expected_procedure_lock_version : null,
        p_actor_id: user.id,
        p_change_summary: cleanPlaybookText(payload.change_summary, 1000) || 'Applied owner-approved AI proposal',
      })
      if (error) throw error
    } else if (body.action === 'task.create') {
      const title = cleanPlaybookText(payload.title, 220)
      if (title.length < 3) throw new Error('Task title is required.')
      const references = [
        ['procedure_id', 'playbook_procedures'], ['proposal_id', 'playbook_change_proposals'],
        ['role_id', 'playbook_roles'], ['person_id', 'playbook_people'],
      ] as const
      for (const [field, table] of references) {
        if (payload[field] && !await existsInWorkspace(admin, table, workspace.id, payload[field])) throw new Error(`Invalid ${field}.`)
      }
      const status = parseTaskStatus(payload.status)
      const dueDate = typeof payload.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.due_date) ? payload.due_date : null
      const { error } = await admin.from('playbook_tasks').insert({
        workspace_id: workspace.id, title, description: cleanPlaybookText(payload.description, 2000),
        procedure_id: payload.procedure_id || null, proposal_id: payload.proposal_id || null,
        role_id: payload.role_id || null, person_id: payload.person_id || null,
        priority: parsePriority(payload.priority), status, due_date: dueDate,
        completed_at: status === 'done' ? new Date().toISOString() : null,
        created_by: user.id, updated_by: user.id,
      })
      if (error) throw error
    } else if (body.action === 'task.update') {
      if (!isUuid(payload.id)) throw new Error('Task not found.')
      const changes: Record<string, unknown> = { updated_by: user.id }
      if ('title' in payload) changes.title = cleanPlaybookText(payload.title, 220)
      if ('description' in payload) changes.description = cleanPlaybookText(payload.description, 2000)
      if ('priority' in payload) changes.priority = parsePriority(payload.priority)
      if ('status' in payload) {
        const status = parseTaskStatus(payload.status)
        changes.status = status
        changes.completed_at = status === 'done' ? new Date().toISOString() : null
      }
      for (const [field, table] of [['role_id', 'playbook_roles'], ['person_id', 'playbook_people']] as const) {
        if (field in payload) {
          if (payload[field] && !await existsInWorkspace(admin, table, workspace.id, payload[field])) throw new Error(`Invalid ${field}.`)
          changes[field] = payload[field] || null
        }
      }
      const { data, error } = await admin.from('playbook_tasks').update(changes).eq('workspace_id', workspace.id).eq('id', payload.id).select('id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Task not found.')
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return databaseError(error)
  }
}
