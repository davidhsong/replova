'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createDemoFeedbackEntries, FEEDBACK_DEMO_DATASET_VERSION } from '@/lib/feedbackDemo'
import {
  EMPTY_PLAYBOOK_STATE,
  PLAYBOOK_CATEGORIES,
  playbookCounts,
  snapshotFromProcedure,
  type PlaybookPriority,
  type PlaybookProcedure,
  type PlaybookProcedureSnapshot,
  type PlaybookProposal,
  type PlaybookState,
  type PlaybookTaskStatus,
} from '@/lib/playbook'
import {
  applyPlaybookDemoAction,
  createInitialPlaybookDemoState,
  isPlaybookDemoState,
  PLAYBOOK_DEMO_LABEL,
  PLAYBOOK_DEMO_VERSION,
  type DemoAction,
  type PlaybookDemoState,
} from '@/lib/playbookDemo'
import type { PlaybookAIProposal } from '@/lib/playbookAIContract'
import styles from './Playbook.module.css'

type Tab = 'overview' | 'procedures' | 'people' | 'suggestions' | 'history'
type Mode = 'real' | 'demo'

type Props = {
  mode: Mode
  workspaceId: string
  workspaceName: string
  demoStorageKey?: string
}

type ProcedureDraft = PlaybookProcedureSnapshot & { change_summary: string }
type ProposalEditDraft = {
  problem: string
  expected_benefit: string
  rationale: string
  priority: PlaybookPriority
  suggested_role_id: string | null
  proposed_snapshot: PlaybookProcedureSnapshot
}

const EMPTY_PROCEDURE: ProcedureDraft = {
  title: '',
  category: 'General Operations',
  description: '',
  objective: '',
  steps: [''],
  responsible_role_id: null,
  assigned_person_id: null,
  status: 'draft',
  change_summary: 'Initial procedure',
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})

function humanStatus(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase())
}

function snapshotFromDraft(draft: ProcedureDraft): PlaybookProcedureSnapshot {
  return {
    title: draft.title,
    category: draft.category,
    description: draft.description,
    objective: draft.objective,
    steps: draft.steps.map(step => step.trim()).filter(Boolean),
    responsible_role_id: draft.responsible_role_id || null,
    assigned_person_id: draft.assigned_person_id || null,
    status: draft.status,
  }
}

function ProcedureForm({
  draft,
  setDraft,
  roles,
  people,
  saving,
  editing,
  onCancel,
  onSubmit,
}: {
  draft: ProcedureDraft
  setDraft: React.Dispatch<React.SetStateAction<ProcedureDraft>>
  roles: PlaybookState['roles']
  people: PlaybookState['people']
  saving: boolean
  editing: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <form className={styles.editor} onSubmit={event => { event.preventDefault(); onSubmit() }}>
      <div className={styles.editorHeading}>
        <div>
          <span>{editing ? 'Edit procedure' : 'New procedure'}</span>
          <h2>{editing ? 'Create an auditable version' : 'Document how work should happen'}</h2>
        </div>
        <button type="button" className={styles.textButton} onClick={onCancel}>Cancel</button>
      </div>
      <div className={styles.formGrid}>
        <label className={styles.fieldWide}>Title
          <input required minLength={3} maxLength={180} value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} />
        </label>
        <label>Category
          <select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value as ProcedureDraft['category'] }))}>
            {PLAYBOOK_CATEGORIES.map(category => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Status
          <select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as ProcedureDraft['status'] }))}>
            <option value="draft">Draft</option>
            <option value="active">Active — owner approved</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className={styles.fieldWide}>Description
          <textarea maxLength={4000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} />
        </label>
        <label className={styles.fieldWide}>Business objective
          <textarea maxLength={2000} value={draft.objective} onChange={event => setDraft(current => ({ ...current, objective: event.target.value }))} />
        </label>
        <label>Responsible role
          <select value={draft.responsible_role_id ?? ''} onChange={event => setDraft(current => ({ ...current, responsible_role_id: event.target.value || null }))}>
            <option value="">Unassigned</option>
            {roles.filter(role => role.active).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
          </select>
        </label>
        <label>Assigned employee (optional)
          <select value={draft.assigned_person_id ?? ''} onChange={event => setDraft(current => ({ ...current, assigned_person_id: event.target.value || null }))}>
            <option value="">Role only</option>
            {people.filter(person => person.active).map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </select>
        </label>
        <label className={styles.fieldWide}>Steps — one per line
          <textarea
            required
            className={styles.stepsInput}
            value={draft.steps.join('\n')}
            onChange={event => setDraft(current => ({ ...current, steps: event.target.value.split('\n').slice(0, 30) }))}
          />
        </label>
        <label className={styles.fieldWide}>Change summary
          <input required minLength={3} maxLength={1000} value={draft.change_summary} onChange={event => setDraft(current => ({ ...current, change_summary: event.target.value }))} />
        </label>
      </div>
      {draft.status === 'active' ? (
        <p className={styles.approvalNote}>Saving as Active records this version as owner-approved. AI suggestions never reach this state automatically.</p>
      ) : null}
      <div className={styles.formActions}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : draft.status === 'active' ? 'Approve and save version' : 'Save version'}
        </button>
      </div>
    </form>
  )
}

export default function PlaybookClient({ mode, workspaceId, workspaceName, demoStorageKey }: Props) {
  const [state, setState] = useState<PlaybookState | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editingProcedure, setEditingProcedure] = useState<PlaybookProcedure | null | 'new'>(null)
  const [procedureDraft, setProcedureDraft] = useState<ProcedureDraft>(EMPTY_PROCEDURE)
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null)
  const [proposalDraft, setProposalDraft] = useState<ProposalEditDraft | null>(null)
  const [roleDraft, setRoleDraft] = useState({ id: '', name: '', department: 'General Operations', responsibilities: '' })
  const [personDraft, setPersonDraft] = useState({ id: '', display_name: '', job_title: '', department: 'General Operations', responsibilities: '', role_id: '' })
  const [taskDraft, setTaskDraft] = useState({ title: '', description: '', procedure_id: '', proposal_id: '', role_id: '', person_id: '', priority: 'medium' as PlaybookPriority, status: 'todo' as PlaybookTaskStatus })

  const loadRealState = useCallback(async () => {
    const response = await fetch(`/api/playbook?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store' })
    const result = await response.json() as { state?: PlaybookState; error?: string }
    if (!response.ok || !result.state) throw new Error(result.error || 'Unable to load Playbook.')
    setState(result.state)
  }, [workspaceId])

  useEffect(() => {
    let cancelled = false
    async function initialize() {
      try {
        if (mode === 'demo') {
          if (!demoStorageKey) throw new Error('Demo storage is unavailable.')
          const raw = window.localStorage.getItem(demoStorageKey)
          const parsed = raw ? JSON.parse(raw) : null
          const demoState = isPlaybookDemoState(parsed, workspaceId)
            ? parsed
            : createInitialPlaybookDemoState(workspaceId)
          if (!cancelled) {
            setState(demoState)
            window.localStorage.setItem(demoStorageKey, JSON.stringify(demoState))
          }
        } else {
          await loadRealState()
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to load Playbook.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    initialize()
    return () => { cancelled = true }
  }, [demoStorageKey, loadRealState, mode, workspaceId])

  function storeDemo(next: PlaybookDemoState) {
    if (!demoStorageKey) throw new Error('Demo storage is unavailable.')
    setState(next)
    window.localStorage.setItem(demoStorageKey, JSON.stringify(next))
  }

  async function mutate(action: DemoAction | string, payload: Record<string, unknown>, success: string) {
    if (!state) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'demo') {
        storeDemo(applyPlaybookDemoAction(state as PlaybookDemoState, action as DemoAction, payload))
      } else {
        const response = await fetch('/api/playbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, action, payload }),
        })
        const result = await response.json() as { error?: string }
        if (!response.ok) throw new Error(result.error || 'Unable to save the change.')
        await loadRealState()
      }
      setNotice(success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save the change.')
      throw caught
    } finally {
      setSaving(false)
    }
  }

  const counts = useMemo(() => playbookCounts(state ?? EMPTY_PLAYBOOK_STATE), [state])
  const roleById = useMemo(() => new Map((state?.roles ?? []).map(role => [role.id, role])), [state])
  const personById = useMemo(() => new Map((state?.people ?? []).map(person => [person.id, person])), [state])
  const procedureById = useMemo(() => new Map((state?.procedures ?? []).map(procedure => [procedure.id, procedure])), [state])
  const demoFeedback = useMemo(() => createDemoFeedbackEntries(), [])
  const demoFeedbackById = useMemo(() => new Map(demoFeedback.map(item => [item.id, item])), [demoFeedback])

  const visibleProcedures = useMemo(() => (state?.procedures ?? []).filter(procedure => {
    const matchesSearch = `${procedure.title} ${procedure.description}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch
      && (categoryFilter === 'all' || procedure.category === categoryFilter)
      && (statusFilter === 'all' || procedure.status === statusFilter)
  }), [categoryFilter, search, state, statusFilter])

  function openNewProcedure() {
    setEditingProcedure('new')
    setProcedureDraft({ ...EMPTY_PROCEDURE, steps: [''] })
  }

  function openProcedureEdit(procedure: PlaybookProcedure) {
    setEditingProcedure(procedure)
    setProcedureDraft({ ...snapshotFromProcedure(procedure), steps: [...procedure.steps], change_summary: `Update ${procedure.title}` })
  }

  async function saveProcedure() {
    if (!editingProcedure) return
    const snapshot = snapshotFromDraft(procedureDraft)
    try {
      if (editingProcedure === 'new') {
        await mutate('procedure.create', { snapshot, change_summary: procedureDraft.change_summary }, 'Procedure created with version 1.')
      } else {
        await mutate('procedure.update', {
          id: editingProcedure.id,
          expected_lock_version: editingProcedure.lock_version,
          snapshot,
          change_summary: procedureDraft.change_summary,
        }, 'Procedure version saved.')
      }
      setEditingProcedure(null)
    } catch { /* error is shown in the page */ }
  }

  async function saveRole() {
    try {
      const action = roleDraft.id ? 'role.update' : 'role.create'
      await mutate(action, roleDraft, roleDraft.id ? 'Role updated.' : 'Role added. No login account was created.')
      setRoleDraft({ id: '', name: '', department: 'General Operations', responsibilities: '' })
    } catch { /* error is shown in the page */ }
  }

  async function savePerson() {
    try {
      const action = personDraft.id ? 'person.update' : 'person.create'
      await mutate(action, { ...personDraft, role_id: personDraft.role_id || null }, personDraft.id ? 'Directory entry updated.' : 'Employee directory entry added. No login account was created.')
      setPersonDraft({ id: '', display_name: '', job_title: '', department: 'General Operations', responsibilities: '', role_id: '' })
    } catch { /* error is shown in the page */ }
  }

  async function createTask() {
    try {
      await mutate('task.create', {
        ...taskDraft,
        procedure_id: taskDraft.procedure_id || null,
        proposal_id: taskDraft.proposal_id || null,
        role_id: taskDraft.role_id || null,
        person_id: taskDraft.person_id || null,
      }, 'Improvement task created.')
      setTaskDraft({ title: '', description: '', procedure_id: '', proposal_id: '', role_id: '', person_id: '', priority: 'medium', status: 'todo' })
    } catch { /* error is shown in the page */ }
  }

  async function suggestImprovements() {
    if (!state) return
    setAnalysisLoading(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint = mode === 'demo' ? '/api/playbook/demo/suggest' : '/api/playbook/suggest'
      const body = mode === 'demo'
        ? {
            workspaceId,
            datasetVersion: FEEDBACK_DEMO_DATASET_VERSION,
            demoVersion: PLAYBOOK_DEMO_VERSION,
            roles: state.roles,
            people: state.people,
            procedures: state.procedures,
          }
        : { workspaceId }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { error?: string; proposals?: PlaybookAIProposal[]; model?: string; count?: number }
      if (!response.ok) throw new Error(result.error || 'Unable to generate suggestions.')
      if (mode === 'demo') {
        storeDemo(applyPlaybookDemoAction(state as PlaybookDemoState, 'proposal.addMany', {
          proposals: result.proposals ?? [], model: result.model,
        }))
      } else {
        await loadRealState()
      }
      setTab('suggestions')
      setNotice(`${result.proposals?.length ?? result.count ?? 0} evidence-backed suggestion${(result.proposals?.length ?? result.count ?? 0) === 1 ? '' : 's'} ready for owner review.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to generate suggestions.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  function beginProposalEdit(proposal: PlaybookProposal) {
    setEditingProposalId(proposal.id)
    setProposalDraft({
      problem: proposal.problem,
      expected_benefit: proposal.expected_benefit,
      rationale: proposal.rationale,
      priority: proposal.priority,
      suggested_role_id: proposal.suggested_role_id,
      proposed_snapshot: structuredClone(proposal.proposed_snapshot),
    })
  }

  async function reviewProposal(proposal: PlaybookProposal, reviewAction: 'edit' | 'approve' | 'reject') {
    try {
      await mutate('proposal.review', {
        id: proposal.id,
        expected_lock_version: proposal.lock_version,
        review_action: reviewAction,
        edits: reviewAction === 'edit' ? proposalDraft : null,
      }, reviewAction === 'approve' ? 'Proposal approved. Apply it separately when ready.' : reviewAction === 'reject' ? 'Proposal rejected. The active procedure was not changed.' : 'Proposal edits saved for review.')
      setEditingProposalId(null)
      setProposalDraft(null)
    } catch { /* error is shown in the page */ }
  }

  async function applyProposal(proposal: PlaybookProposal) {
    const procedure = proposal.procedure_id ? procedureById.get(proposal.procedure_id) : null
    try {
      await mutate('proposal.apply', {
        id: proposal.id,
        expected_lock_version: proposal.lock_version,
        expected_procedure_lock_version: procedure?.lock_version ?? null,
        change_summary: `Applied approved proposal: ${proposal.problem.slice(0, 160)}`,
      }, 'Approved change applied as a new auditable procedure version.')
    } catch { /* error is shown in the page */ }
  }

  function proposalEvidence(proposal: PlaybookProposal) {
    if (mode !== 'demo') return proposal.evidence
    return proposal.evidence.map(link => {
      const feedback = demoFeedbackById.get(link.review_id)
      return feedback ? {
        ...link,
        rating: feedback.rating,
        text: feedback.text,
        received_at: feedback.receivedAt,
      } : link
    })
  }

  function resetDemo() {
    if (mode !== 'demo' || !window.confirm('Reset all synthetic Playbook roles, procedures, proposals, and tasks?')) return
    storeDemo(createInitialPlaybookDemoState(workspaceId))
    setTab('overview')
    setNotice('Synthetic Playbook demo reset.')
    setError(null)
  }

  if (loading) {
    return <div className={styles.loading} aria-label="Loading Business Playbook"><span /><span /><span /></div>
  }

  if (!state) {
    return <div className={styles.fatal}><h1>Playbook could not load</h1><p>{error}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button></div>
  }

  return (
    <div className={styles.page} data-demo={mode === 'demo'}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>
            <span>Operations</span>
            {mode === 'demo' ? <em>{PLAYBOOK_DEMO_LABEL}</em> : <em>Workspace records</em>}
          </div>
          <h1>Business Playbook</h1>
          <p>
            Turn authorized customer feedback into owner-approved procedures, responsibilities, and improvement work for <strong>{workspaceName}</strong>.
          </p>
        </div>
        <div className={styles.heroActions}>
          {mode === 'demo' ? (
            <button type="button" className="btn btn-ghost" onClick={resetDemo}>Reset demo</button>
          ) : <Link href="/dashboard/playbook/demo" className="btn btn-ghost">Open synthetic demo</Link>}
          <button type="button" className="btn btn-primary" onClick={suggestImprovements} disabled={analysisLoading}>
            {analysisLoading ? 'Analyzing feedback…' : 'Suggest playbook improvements'}
          </button>
        </div>
      </header>

      {mode === 'demo' ? (
        <div className={styles.demoBoundary}>
          <strong>Synthetic demo boundary</strong>
          <span>Fictional people, procedures, proposals, and tasks stay in this browser. AI uses the 60 canonical synthetic feedback records. Nothing can publish externally.</span>
        </div>
      ) : (
        <div className={styles.safetyBoundary}>
          <strong>Owner-controlled operations</strong>
          <span>AI suggestions remain pending until you approve them, then require a separate Apply action. New feedback is analyzed only when you request it.</span>
        </div>
      )}

      {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
      {error ? <div className={styles.error} role="alert">{error}</div> : null}

      <nav className={styles.tabs} aria-label="Playbook sections">
        {([
          ['overview', 'Overview'], ['procedures', 'Procedures'], ['people', 'People & Roles'],
          ['suggestions', 'Suggested Changes'], ['history', 'History'],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button key={value} type="button" aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>
            {label}
            {value === 'suggestions' && counts.pendingProposals > 0 ? <span>{counts.pendingProposals}</span> : null}
          </button>
        ))}
      </nav>

      <main className={styles.content}>
        {tab === 'overview' ? (
          <div className={styles.sectionStack}>
            <section className={styles.metrics} aria-label="Playbook summary">
              <article><span>Active procedures</span><strong>{counts.activeProcedures}</strong><small>owner-approved versions</small></article>
              <article><span>Draft procedures</span><strong>{counts.draftProcedures}</strong><small>not yet active</small></article>
              <article><span>Pending suggestions</span><strong>{counts.pendingProposals}</strong><small>awaiting review or apply</small></article>
              <article><span>Open improvement tasks</span><strong>{counts.openTasks}</strong><small>to do or in progress</small></article>
            </section>

            <section className={styles.workflowCard}>
              <div className={styles.sectionHeading}><div><span>Evidence-to-action workflow</span><h2>Keep every operating change accountable</h2></div></div>
              <ol>
                <li><b>01</b><div><strong>Authorized feedback</strong><span>Only workspace feedback or the labeled synthetic demo is eligible.</span></div></li>
                <li><b>02</b><div><strong>Evidence-backed proposal</strong><span>Replova cites the records supporting each recurring problem.</span></div></li>
                <li><b>03</b><div><strong>Owner review</strong><span>Edit, approve, reject, then separately apply the proposed change.</span></div></li>
                <li><b>04</b><div><strong>Auditable execution</strong><span>A new version preserves history and can link to responsible work.</span></div></li>
              </ol>
            </section>

            <section className={styles.splitGrid}>
              <div className={styles.panel}>
                <div className={styles.sectionHeading}><div><span>Recently updated</span><h2>Procedures</h2></div><button type="button" onClick={() => setTab('procedures')}>View all</button></div>
                <div className={styles.compactList}>
                  {state.procedures.slice(0, 5).map(procedure => (
                    <button key={procedure.id} type="button" onClick={() => { setTab('procedures'); openProcedureEdit(procedure) }}>
                      <span data-status={procedure.status}>{procedure.status}</span>
                      <div><strong>{procedure.title}</strong><small>{procedure.category} · v{procedure.current_version}</small></div>
                    </button>
                  ))}
                  {state.procedures.length === 0 ? <p className={styles.emptyInline}>Create your first procedure or open the synthetic demo.</p> : null}
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.sectionHeading}><div><span>Owner review queue</span><h2>Suggested changes</h2></div><button type="button" onClick={() => setTab('suggestions')}>View queue</button></div>
                <div className={styles.compactList}>
                  {state.proposals.filter(proposal => proposal.status === 'pending' || proposal.status === 'approved').slice(0, 4).map(proposal => (
                    <button key={proposal.id} type="button" onClick={() => setTab('suggestions')}>
                      <span data-priority={proposal.priority}>{proposal.priority}</span>
                      <div><strong>{proposal.problem}</strong><small>{proposal.evidence.length} evidence records · {humanStatus(proposal.status)}</small></div>
                    </button>
                  ))}
                  {counts.pendingProposals === 0 ? <p className={styles.emptyInline}>No suggestions are waiting. Run a feedback analysis when ready.</p> : null}
                </div>
              </div>
            </section>

            <section className={styles.taskPanel}>
              <div className={styles.sectionHeading}><div><span>Operational follow-through</span><h2>Improvement tasks</h2></div></div>
              <div className={styles.taskLayout}>
                <div className={styles.taskList}>
                  {state.tasks.map(task => (
                    <article key={task.id} data-complete={task.status === 'done'}>
                      <button
                        type="button"
                        aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                        onClick={() => mutate('task.update', { id: task.id, status: task.status === 'done' ? 'todo' : 'done' }, task.status === 'done' ? 'Task reopened.' : 'Task completed.')}
                      >{task.status === 'done' ? 'Done' : 'Complete'}</button>
                      <div><strong>{task.title}</strong><small>{task.procedure_id ? procedureById.get(task.procedure_id)?.title : 'General improvement'} · {task.role_id ? roleById.get(task.role_id)?.name : 'Unassigned'}</small></div>
                      <span data-priority={task.priority}>{task.priority}</span>
                      <select aria-label={`Status for ${task.title}`} value={task.status} onChange={event => mutate('task.update', { id: task.id, status: event.target.value }, 'Task status updated.')}>
                        <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
                      </select>
                    </article>
                  ))}
                  {state.tasks.length === 0 ? <p className={styles.emptyInline}>No improvement tasks yet.</p> : null}
                </div>
                <form className={styles.taskForm} onSubmit={event => { event.preventDefault(); createTask() }}>
                  <strong>Create improvement task</strong>
                  <label>Task<input required minLength={3} maxLength={220} value={taskDraft.title} onChange={event => setTaskDraft(current => ({ ...current, title: event.target.value }))} /></label>
                  <label>Description<textarea maxLength={2000} value={taskDraft.description} onChange={event => setTaskDraft(current => ({ ...current, description: event.target.value }))} /></label>
                  <div>
                    <label>Procedure<select value={taskDraft.procedure_id} onChange={event => setTaskDraft(current => ({ ...current, procedure_id: event.target.value }))}><option value="">General</option>{state.procedures.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
                    <label>Role<select value={taskDraft.role_id} onChange={event => setTaskDraft(current => ({ ...current, role_id: event.target.value }))}><option value="">Unassigned</option>{state.roles.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                  </div>
                  <div>
                    <label>Priority<select value={taskDraft.priority} onChange={event => setTaskDraft(current => ({ ...current, priority: event.target.value as PlaybookPriority }))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
                    <label>Status<select value={taskDraft.status} onChange={event => setTaskDraft(current => ({ ...current, status: event.target.value as PlaybookTaskStatus }))}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block" disabled={saving}>Create task</button>
                </form>
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'procedures' ? (
          <div className={styles.sectionStack}>
            <div className={styles.sectionToolbar}>
              <div><span>Operating procedures</span><h2>Document and improve how work gets done</h2></div>
              <button type="button" className="btn btn-primary" onClick={openNewProcedure}>New procedure</button>
            </div>
            {editingProcedure ? <ProcedureForm draft={procedureDraft} setDraft={setProcedureDraft} roles={state.roles} people={state.people} saving={saving} editing={editingProcedure !== 'new'} onCancel={() => setEditingProcedure(null)} onSubmit={saveProcedure} /> : null}
            <div className={styles.filters}>
              <label><span>Search</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search procedures" /></label>
              <label><span>Category</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{PLAYBOOK_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
              <label><span>Status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            </div>
            <div className={styles.procedureList}>
              {visibleProcedures.map(procedure => (
                <article key={procedure.id}>
                  <div className={styles.procedureTopline}><span data-status={procedure.status}>{procedure.status}</span><small>{procedure.category} · version {procedure.current_version}</small></div>
                  <h3>{procedure.title}</h3>
                  <p>{procedure.description || 'No description yet.'}</p>
                  {procedure.objective ? <div className={styles.objective}><span>Objective</span>{procedure.objective}</div> : null}
                  <ol>{procedure.steps.map((step, index) => <li key={`${procedure.id}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><span>{step}</span></li>)}</ol>
                  <div className={styles.assignmentRow}>
                    <span>Responsible: <strong>{procedure.responsible_role_id ? roleById.get(procedure.responsible_role_id)?.name : 'Unassigned'}</strong></span>
                    <span>Employee: <strong>{procedure.assigned_person_id ? personById.get(procedure.assigned_person_id)?.display_name : 'Role only'}</strong></span>
                    <small>Updated {dateFormatter.format(new Date(procedure.updated_at))}</small>
                    <button type="button" onClick={() => openProcedureEdit(procedure)}>Edit and version</button>
                  </div>
                </article>
              ))}
              {visibleProcedures.length === 0 ? <div className={styles.empty}><strong>No procedures match these filters</strong><p>Create a procedure or adjust the filters.</p></div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'people' ? (
          <div className={styles.sectionStack}>
            <div className={styles.sectionToolbar}><div><span>People & roles</span><h2>Assign responsibility without creating login accounts</h2></div></div>
            <div className={styles.peopleGrid}>
              <section className={styles.panel}>
                <div className={styles.sectionHeading}><div><span>Business roles</span><h2>{state.roles.filter(role => role.active).length} active roles</h2></div></div>
                <form className={styles.directoryForm} onSubmit={event => { event.preventDefault(); saveRole() }}>
                  <label>Role name<input required minLength={2} value={roleDraft.name} onChange={event => setRoleDraft(current => ({ ...current, name: event.target.value }))} placeholder="Service Advisor" /></label>
                  <label>Department<input required minLength={2} value={roleDraft.department} onChange={event => setRoleDraft(current => ({ ...current, department: event.target.value }))} /></label>
                  <label>Responsibilities<textarea maxLength={2000} value={roleDraft.responsibilities} onChange={event => setRoleDraft(current => ({ ...current, responsibilities: event.target.value }))} /></label>
                  <div><button type="submit" className="btn btn-primary" disabled={saving}>{roleDraft.id ? 'Save role' : 'Add role'}</button>{roleDraft.id ? <button type="button" className="btn btn-ghost" onClick={() => setRoleDraft({ id: '', name: '', department: 'General Operations', responsibilities: '' })}>Cancel</button> : null}</div>
                </form>
                <div className={styles.directoryList}>
                  {state.roles.map(role => (
                    <article key={role.id} data-inactive={!role.active}>
                      <div><strong>{role.name}</strong><small>{role.department} · {state.procedures.filter(item => item.responsible_role_id === role.id).length} procedures</small><p>{role.responsibilities || 'No responsibilities recorded.'}</p></div>
                      <div><button type="button" onClick={() => setRoleDraft({ id: role.id, name: role.name, department: role.department, responsibilities: role.responsibilities })}>Edit</button><button type="button" onClick={() => mutate('role.update', { id: role.id, active: !role.active }, role.active ? 'Role deactivated.' : 'Role reactivated.')}>{role.active ? 'Deactivate' : 'Reactivate'}</button></div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.panel}>
                <div className={styles.sectionHeading}><div><span>Employee directory</span><h2>{state.people.filter(person => person.active).length} active entries</h2></div></div>
                <div className={styles.directoryNotice}>Directory entries are operational records only. Adding someone here never creates Supabase Auth access, sends an invitation, or scores performance.</div>
                <form className={styles.directoryForm} onSubmit={event => { event.preventDefault(); savePerson() }}>
                  <label>Display name<input required minLength={2} value={personDraft.display_name} onChange={event => setPersonDraft(current => ({ ...current, display_name: event.target.value }))} /></label>
                  <label>Job title<input required minLength={2} value={personDraft.job_title} onChange={event => setPersonDraft(current => ({ ...current, job_title: event.target.value }))} /></label>
                  <label>Department<input required minLength={2} value={personDraft.department} onChange={event => setPersonDraft(current => ({ ...current, department: event.target.value }))} /></label>
                  <label>Role<select value={personDraft.role_id} onChange={event => setPersonDraft(current => ({ ...current, role_id: event.target.value }))}><option value="">No linked role</option>{state.roles.filter(role => role.active).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                  <label className={styles.fieldWide}>Responsibilities<textarea maxLength={2000} value={personDraft.responsibilities} onChange={event => setPersonDraft(current => ({ ...current, responsibilities: event.target.value }))} /></label>
                  <div><button type="submit" className="btn btn-primary" disabled={saving}>{personDraft.id ? 'Save entry' : 'Add employee entry'}</button>{personDraft.id ? <button type="button" className="btn btn-ghost" onClick={() => setPersonDraft({ id: '', display_name: '', job_title: '', department: 'General Operations', responsibilities: '', role_id: '' })}>Cancel</button> : null}</div>
                </form>
                <div className={styles.directoryList}>
                  {state.people.map(person => (
                    <article key={person.id} data-inactive={!person.active}>
                      <div><strong>{person.display_name}</strong><small>{person.job_title} · {person.department}</small><p>{person.responsibilities || 'No individual responsibilities recorded.'}</p></div>
                      <div><button type="button" onClick={() => setPersonDraft({ id: person.id, display_name: person.display_name, job_title: person.job_title, department: person.department, responsibilities: person.responsibilities, role_id: person.role_id ?? '' })}>Edit</button><button type="button" onClick={() => mutate('person.update', { id: person.id, active: !person.active }, person.active ? 'Directory entry deactivated.' : 'Directory entry reactivated.')}>{person.active ? 'Deactivate' : 'Reactivate'}</button></div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {tab === 'suggestions' ? (
          <div className={styles.sectionStack}>
            <div className={styles.sectionToolbar}>
              <div><span>Suggested changes</span><h2>Inspect evidence, edit the proposal, then decide</h2></div>
              <button type="button" className="btn btn-primary" onClick={suggestImprovements} disabled={analysisLoading}>{analysisLoading ? 'Analyzing…' : 'Refresh suggestions'}</button>
            </div>
            <div className={styles.suggestionList}>
              {state.proposals.map(proposal => {
                const existing = proposal.procedure_id ? procedureById.get(proposal.procedure_id) : null
                const evidence = proposalEvidence(proposal)
                const editing = editingProposalId === proposal.id && proposalDraft
                return (
                  <article key={proposal.id}>
                    <div className={styles.proposalHeader}>
                      <div><span data-priority={proposal.priority}>{proposal.priority} priority</span><span data-status={proposal.status}>{proposal.status}</span></div>
                      <small>{proposal.model} · {dateFormatter.format(new Date(proposal.created_at))}</small>
                    </div>
                    {editing ? (
                      <form className={styles.proposalEditor} onSubmit={event => { event.preventDefault(); reviewProposal(proposal, 'edit') }}>
                        <label>Problem<textarea value={proposalDraft.problem} onChange={event => setProposalDraft(current => current ? ({ ...current, problem: event.target.value }) : null)} /></label>
                        <label>Expected benefit hypothesis<textarea value={proposalDraft.expected_benefit} onChange={event => setProposalDraft(current => current ? ({ ...current, expected_benefit: event.target.value }) : null)} /></label>
                        <label>Rationale<textarea value={proposalDraft.rationale} onChange={event => setProposalDraft(current => current ? ({ ...current, rationale: event.target.value }) : null)} /></label>
                        <div><label>Priority<select value={proposalDraft.priority} onChange={event => setProposalDraft(current => current ? ({ ...current, priority: event.target.value as PlaybookPriority }) : null)}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label><label>Responsible role<select value={proposalDraft.suggested_role_id ?? ''} onChange={event => setProposalDraft(current => current ? ({ ...current, suggested_role_id: event.target.value || null, proposed_snapshot: { ...current.proposed_snapshot, responsible_role_id: event.target.value || null } }) : null)}><option value="">Unassigned</option>{state.roles.filter(role => role.active).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label></div>
                        <label>Proposed title<input value={proposalDraft.proposed_snapshot.title} onChange={event => setProposalDraft(current => current ? ({ ...current, proposed_snapshot: { ...current.proposed_snapshot, title: event.target.value } }) : null)} /></label>
                        <label>Proposed description<textarea value={proposalDraft.proposed_snapshot.description} onChange={event => setProposalDraft(current => current ? ({ ...current, proposed_snapshot: { ...current.proposed_snapshot, description: event.target.value } }) : null)} /></label>
                        <label>Proposed objective<textarea value={proposalDraft.proposed_snapshot.objective} onChange={event => setProposalDraft(current => current ? ({ ...current, proposed_snapshot: { ...current.proposed_snapshot, objective: event.target.value } }) : null)} /></label>
                        <label>Proposed steps — one per line<textarea value={proposalDraft.proposed_snapshot.steps.join('\n')} onChange={event => setProposalDraft(current => current ? ({ ...current, proposed_snapshot: { ...current.proposed_snapshot, steps: event.target.value.split('\n') } }) : null)} /></label>
                        <div className={styles.formActions}><button type="button" className="btn btn-ghost" onClick={() => { setEditingProposalId(null); setProposalDraft(null) }}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>Save proposal edits</button></div>
                      </form>
                    ) : (
                      <>
                        <div className={styles.proposalSummary}><span>Problem identified</span><h3>{proposal.problem}</h3><p>{proposal.rationale}</p></div>
                        <div className={styles.diffGrid}>
                          <section><span>{existing ? `Current procedure · v${existing.current_version}` : 'Current procedure'}</span>{existing ? <><strong>{existing.title}</strong><p>{existing.description}</p><ol>{existing.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></> : <p>No existing procedure. Replova is suggesting a new draft.</p>}</section>
                          <section><span>Proposed procedure</span><strong>{proposal.proposed_snapshot.title}</strong><p>{proposal.proposed_snapshot.description}</p><ol>{proposal.proposed_snapshot.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
                        </div>
                        <div className={styles.hypothesis}><span>Expected operational benefit · hypothesis</span><p>{proposal.expected_benefit}</p></div>
                        <details className={styles.evidence}>
                          <summary>{evidence.length} supporting feedback records</summary>
                          <div>{evidence.map(item => <article key={item.review_id}><div><strong>{item.rating > 0 ? `${item.rating}/5` : 'Feedback'}</strong><code>{item.review_id}</code></div><p>{item.text}</p><small>{mode === 'demo' ? 'Synthetic demo evidence' : 'Authorized workspace feedback'} · {item.received_at ? dateFormatter.format(new Date(item.received_at)) : 'Date unavailable'}</small></article>)}</div>
                        </details>
                        <div className={styles.proposalActions}>
                          {proposal.status === 'pending' ? <><button type="button" className="btn btn-ghost" onClick={() => beginProposalEdit(proposal)}>Edit proposal</button><button type="button" className="btn btn-ghost" onClick={() => reviewProposal(proposal, 'reject')}>Reject</button><button type="button" className="btn btn-primary" onClick={() => reviewProposal(proposal, 'approve')}>Approve proposal</button></> : null}
                          {proposal.status === 'approved' ? <><button type="button" className="btn btn-ghost" onClick={() => reviewProposal(proposal, 'reject')}>Reject instead</button><button type="button" className="btn btn-primary" onClick={() => applyProposal(proposal)}>Apply as new version</button></> : null}
                          {proposal.status !== 'rejected' ? <button type="button" className={styles.textButton} onClick={() => { setTaskDraft(current => ({ ...current, title: proposal.proposed_snapshot.title, description: proposal.problem, procedure_id: proposal.procedure_id ?? '', proposal_id: proposal.id, role_id: proposal.suggested_role_id ?? '', priority: proposal.priority })); setTab('overview') }}>Create linked task</button> : null}
                        </div>
                      </>
                    )}
                  </article>
                )
              })}
              {state.proposals.length === 0 ? <div className={styles.empty}><strong>No Playbook suggestions yet</strong><p>Run an explicit analysis. Replova will use only authorized feedback and cite each supporting record.</p><button type="button" className="btn btn-primary" onClick={suggestImprovements}>Suggest playbook improvements</button></div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'history' ? (
          <div className={styles.sectionStack}>
            <div className={styles.sectionToolbar}><div><span>Procedure history</span><h2>An append-only record of operating changes</h2></div></div>
            <div className={styles.historyList}>
              {state.versions.map(version => {
                const procedure = procedureById.get(version.procedure_id)
                return <article key={version.id}><div className={styles.versionMark}>v{version.version_number}</div><div><div><strong>{version.snapshot.title}</strong><span>{version.source === 'ai_proposal' ? 'Owner-approved AI proposal' : 'Manual owner change'}</span></div><p>{version.change_summary}</p><small>{dateFormatter.format(new Date(version.created_at))} · {version.approved_by ? 'Approved version' : 'Draft version'} · {procedure?.category ?? version.snapshot.category}</small><details><summary>Inspect snapshot</summary><ol>{version.snapshot.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></details></div></article>
              })}
              {state.versions.length === 0 ? <div className={styles.empty}><strong>No versions yet</strong><p>Create the first procedure to start the audit history.</p></div> : null}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
