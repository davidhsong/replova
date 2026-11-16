'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createDemoFeedbackEntries,
  FEEDBACK_DEMO_DATASET_VERSION,
} from '@/lib/feedbackDemo'
import {
  PLAYBOOK_CATEGORIES,
  snapshotFromProcedure,
  type PlaybookPriority,
  type PlaybookProcedure,
  type PlaybookProcedureSnapshot,
  type PlaybookProposal,
  type PlaybookState,
  type PlaybookTask,
  type PlaybookTaskStatus,
  type PlaybookVersion,
} from '@/lib/playbook'
import {
  applyPlaybookDemoAction,
  createInitialPlaybookDemoState,
  isPlaybookDemoState,
  PLAYBOOK_DEMO_VERSION,
  type DemoAction,
  type PlaybookDemoState,
} from '@/lib/playbookDemo'
import type { PlaybookAIProposal } from '@/lib/playbookAIContract'
import styles from './Playbook.module.css'

type Mode = 'real' | 'demo'
type View = 'procedures' | 'review' | 'tasks'
type Drawer =
  | { kind: 'suggestion'; id: string }
  | { kind: 'history'; procedureId: string }
  | { kind: 'procedure'; procedureId: string | null }
  | { kind: 'task'; taskId: string | null }
  | { kind: 'directory' }
  | null

type Props = {
  mode: Mode
  workspaceId: string
  workspaceName: string
  demoStorageKey?: string
  initialView?: View
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
type TaskDraft = {
  title: string
  description: string
  procedure_id: string
  proposal_id: string
  role_id: string
  person_id: string
  priority: PlaybookPriority
  status: PlaybookTaskStatus
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
const EMPTY_TASK: TaskDraft = {
  title: '',
  description: '',
  procedure_id: '',
  proposal_id: '',
  role_id: '',
  person_id: '',
  priority: 'medium',
  status: 'todo',
}
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function humanStatus(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function snapshotFromDraft(draft: ProcedureDraft): PlaybookProcedureSnapshot {
  return {
    title: draft.title,
    category: draft.category,
    description: draft.description,
    objective: draft.objective,
    steps: draft.steps.map((step) => step.trim()).filter(Boolean),
    responsible_role_id: draft.responsible_role_id || null,
    assigned_person_id: draft.assigned_person_id || null,
    status: draft.status,
  }
}

function compareSteps(from: string[], to: string[]) {
  return {
    additions: to.filter((step) => !from.includes(step)),
    removals: from.filter((step) => !to.includes(step)),
  }
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="m12.5 12.5 4 4" />
    </svg>
  )
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
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label>
        Procedure title
        <input
          required
          minLength={3}
          maxLength={180}
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({ ...current, title: event.target.value }))
          }
        />
      </label>
      <div className={styles.formPair}>
        <label>
          Category
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value as ProcedureDraft['category'],
              }))
            }
          >
            {PLAYBOOK_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value as ProcedureDraft['status'],
              }))
            }
          >
            <option value="draft">Draft</option>
            <option value="active">Active — owner approved</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>
      <label>
        Summary
        <textarea
          maxLength={4000}
          value={draft.description}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              description: event.target.value,
            }))
          }
        />
      </label>
      <label>
        Purpose
        <textarea
          maxLength={2000}
          value={draft.objective}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              objective: event.target.value,
            }))
          }
        />
      </label>
      <div className={styles.formPair}>
        <label>
          Responsible role
          <select
            value={draft.responsible_role_id ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                responsible_role_id: event.target.value || null,
              }))
            }
          >
            <option value="">Unassigned</option>
            {roles
              .filter((role) => role.active)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Person (optional)
          <select
            value={draft.assigned_person_id ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                assigned_person_id: event.target.value || null,
              }))
            }
          >
            <option value="">Role only</option>
            {people
              .filter((person) => person.active)
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label>
        Steps — one per line
        <textarea
          required
          className={styles.stepsInput}
          value={draft.steps.join('\n')}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              steps: event.target.value.split('\n').slice(0, 30),
            }))
          }
        />
      </label>
      <label>
        Change note
        <input
          required
          minLength={3}
          maxLength={1000}
          value={draft.change_summary}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              change_summary: event.target.value,
            }))
          }
        />
      </label>
      {draft.status === 'active' ? (
        <p className={styles.formNote}>
          Saving this version records it as owner-approved. Suggestions cannot
          activate a procedure automatically.
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={saving}
        >
          {saving
            ? 'Saving…'
            : editing
              ? 'Save new version'
              : 'Create procedure'}
        </button>
      </div>
    </form>
  )
}

export default function PlaybookClient({
  mode,
  workspaceId,
  workspaceName,
  demoStorageKey,
  initialView = 'procedures',
}: Props) {
  const [state, setState] = useState<PlaybookState | null>(null)
  const [view, setView] = useState<View>(initialView)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | null>(
    null,
  )
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [compactLibrary, setCompactLibrary] = useState(false)
  const [drawer, setDrawerState] = useState<Drawer>(null)
  const [procedureDraft, setProcedureDraft] =
    useState<ProcedureDraft>(EMPTY_PROCEDURE)
  const [proposalDraft, setProposalDraft] = useState<ProposalEditDraft | null>(
    null,
  )
  const [editingProposal, setEditingProposal] = useState(false)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(EMPTY_TASK)
  const [roleDraft, setRoleDraft] = useState({
    id: '',
    name: '',
    department: 'General Operations',
    responsibilities: '',
  })
  const [personDraft, setPersonDraft] = useState({
    id: '',
    display_name: '',
    job_title: '',
    department: 'General Operations',
    responsibilities: '',
    role_id: '',
  })
  const [directorySection, setDirectorySection] = useState<'roles' | 'people'>(
    'roles',
  )
  const [historyFromId, setHistoryFromId] = useState('')
  const [historyToId, setHistoryToId] = useState('')

  const loadRealState = useCallback(async () => {
    const response = await fetch(
      `/api/playbook?workspaceId=${encodeURIComponent(workspaceId)}`,
      { cache: 'no-store' },
    )
    const result = (await response.json()) as {
      state?: PlaybookState
      error?: string
    }
    if (!response.ok || !result.state)
      throw new Error(result.error || 'Unable to load Playbook.')
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
            window.localStorage.setItem(
              demoStorageKey,
              JSON.stringify(demoState),
            )
          }
        } else await loadRealState()
      } catch (caught) {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load Playbook.',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    initialize()
    return () => {
      cancelled = true
    }
  }, [demoStorageKey, loadRealState, mode, workspaceId])

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDrawerState(null)
        setLibraryOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [])

  useEffect(() => {
    const compactScreen = window.matchMedia('(max-width: 760px)')
    const syncLibrary = (event: MediaQueryListEvent | MediaQueryList) => {
      setCompactLibrary(event.matches)
    }
    const frame = window.requestAnimationFrame(() => syncLibrary(compactScreen))
    compactScreen.addEventListener('change', syncLibrary)
    return () => {
      window.cancelAnimationFrame(frame)
      compactScreen.removeEventListener('change', syncLibrary)
    }
  }, [])

  function setDrawer(next: Drawer) {
    setDrawerState(next)
    if (next) window.dispatchEvent(new CustomEvent('replova:close-assistant'))
  }

  function storeDemo(next: PlaybookDemoState) {
    if (!demoStorageKey) throw new Error('Demo storage is unavailable.')
    setState(next)
    window.localStorage.setItem(demoStorageKey, JSON.stringify(next))
  }

  async function mutate(
    action: DemoAction | string,
    payload: Record<string, unknown>,
    success: string,
  ) {
    if (!state) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'demo')
        storeDemo(
          applyPlaybookDemoAction(
            state as PlaybookDemoState,
            action as DemoAction,
            payload,
          ),
        )
      else {
        const response = await fetch('/api/playbook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, action, payload }),
        })
        const result = (await response.json()) as { error?: string }
        if (!response.ok)
          throw new Error(result.error || 'Unable to save the change.')
        await loadRealState()
      }
      setNotice(success)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to save the change.',
      )
      throw caught
    } finally {
      setSaving(false)
    }
  }

  const roleById = useMemo(
    () => new Map((state?.roles ?? []).map((role) => [role.id, role])),
    [state],
  )
  const personById = useMemo(
    () => new Map((state?.people ?? []).map((person) => [person.id, person])),
    [state],
  )
  const procedureById = useMemo(
    () =>
      new Map(
        (state?.procedures ?? []).map((procedure) => [procedure.id, procedure]),
      ),
    [state],
  )
  const demoFeedback = useMemo(() => createDemoFeedbackEntries(), [])
  const demoFeedbackById = useMemo(
    () => new Map(demoFeedback.map((item) => [item.id, item])),
    [demoFeedback],
  )
  const effectiveSelectedProcedureId =
    selectedProcedureId && procedureById.has(selectedProcedureId)
      ? selectedProcedureId
      : (state?.procedures[0]?.id ?? null)
  const selectedProcedure = effectiveSelectedProcedureId
    ? (procedureById.get(effectiveSelectedProcedureId) ?? null)
    : null
  const reviewQueue = useMemo(
    () =>
      (state?.proposals ?? []).filter(
        (item) => item.status === 'pending' || item.status === 'approved',
      ),
    [state],
  )
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent('replova:playbook-review-count', {
          detail: { count: reviewQueue.length },
        }),
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [reviewQueue.length])
  useEffect(
    () => () => {
      window.dispatchEvent(
        new CustomEvent('replova:playbook-review-count', { detail: { count: 0 } }),
      )
    },
    [],
  )
  const filteredProcedures = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (state?.procedures ?? []).filter(
      (procedure) =>
        !query ||
        `${procedure.title} ${procedure.description} ${procedure.objective} ${procedure.steps.join(' ')}`
          .toLowerCase()
          .includes(query),
    )
  }, [search, state])
  const categories = useMemo(
    () =>
      PLAYBOOK_CATEGORIES.map((category) => ({
        category,
        procedures: filteredProcedures.filter(
          (item) => item.category === category,
        ),
      })).filter((group) => group.procedures.length),
    [filteredProcedures],
  )
  const selectedSuggestion = selectedProcedure
    ? (reviewQueue.find((item) => item.procedure_id === selectedProcedure.id) ??
      null)
    : null
  const activeProposal =
    drawer?.kind === 'suggestion'
      ? (state?.proposals.find((item) => item.id === drawer.id) ?? null)
      : null
  const activeTask =
    drawer?.kind === 'task' && drawer.taskId
      ? (state?.tasks.find((item) => item.id === drawer.taskId) ?? null)
      : null
  const historyProcedure =
    drawer?.kind === 'history'
      ? (procedureById.get(drawer.procedureId) ?? null)
      : null
  const historyVersions = historyProcedure
    ? (state?.versions ?? [])
        .filter((item) => item.procedure_id === historyProcedure.id)
        .sort((a, b) => b.version_number - a.version_number)
    : []
  const historyFrom =
    historyVersions.find((item) => item.id === historyFromId) ?? null
  const historyTo =
    historyVersions.find((item) => item.id === historyToId) ?? null

  function proposalEvidence(proposal: PlaybookProposal) {
    if (mode !== 'demo') return proposal.evidence
    return proposal.evidence.map((link) => {
      const feedback = demoFeedbackById.get(link.review_id)
      return feedback
        ? {
            ...link,
            rating: feedback.rating,
            text: feedback.text,
            received_at: feedback.receivedAt,
          }
        : link
    })
  }

  function openProcedure(procedure: PlaybookProcedure) {
    setSelectedProcedureId(procedure.id)
    setView('procedures')
    setLibraryOpen(false)
  }

  function openProcedureForm(procedure: PlaybookProcedure | null) {
    setProcedureDraft(
      procedure
        ? {
            ...snapshotFromProcedure(procedure),
            steps: [...procedure.steps],
            change_summary: `Update ${procedure.title}`,
          }
        : { ...EMPTY_PROCEDURE, steps: [''] },
    )
    setDrawer({ kind: 'procedure', procedureId: procedure?.id ?? null })
  }

  async function saveProcedure() {
    if (drawer?.kind !== 'procedure') return
    const procedure = drawer.procedureId
      ? procedureById.get(drawer.procedureId)
      : null
    const snapshot = snapshotFromDraft(procedureDraft)
    try {
      if (!procedure)
        await mutate(
          'procedure.create',
          { snapshot, change_summary: procedureDraft.change_summary },
          'Procedure created with version 1.',
        )
      else
        await mutate(
          'procedure.update',
          {
            id: procedure.id,
            expected_lock_version: procedure.lock_version,
            snapshot,
            change_summary: procedureDraft.change_summary,
          },
          'Procedure version saved.',
        )
      setDrawer(null)
    } catch {
      /* error is displayed */
    }
  }

  async function suggestImprovements() {
    if (!state) return
    setAnalysisLoading(true)
    setError(null)
    setNotice(null)
    try {
      const endpoint =
        mode === 'demo' ? '/api/playbook/demo/suggest' : '/api/playbook/suggest'
      const body =
        mode === 'demo'
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
      const result = (await response.json()) as {
        error?: string
        proposals?: PlaybookAIProposal[]
        model?: string
        count?: number
      }
      if (!response.ok)
        throw new Error(result.error || 'Unable to generate suggestions.')
      if (mode === 'demo')
        storeDemo(
          applyPlaybookDemoAction(
            state as PlaybookDemoState,
            'proposal.addMany',
            { proposals: result.proposals ?? [], model: result.model },
          ),
        )
      else await loadRealState()
      setView('review')
      setNotice(
        `${result.proposals?.length ?? result.count ?? 0} suggestion${(result.proposals?.length ?? result.count ?? 0) === 1 ? '' : 's'} ready for review.`,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to generate suggestions.',
      )
    } finally {
      setAnalysisLoading(false)
    }
  }

  function openSuggestion(proposal: PlaybookProposal) {
    setEditingProposal(false)
    setProposalDraft({
      problem: proposal.problem,
      expected_benefit: proposal.expected_benefit,
      rationale: proposal.rationale,
      priority: proposal.priority,
      suggested_role_id: proposal.suggested_role_id,
      proposed_snapshot: structuredClone(proposal.proposed_snapshot),
    })
    setDrawer({ kind: 'suggestion', id: proposal.id })
  }

  async function reviewProposal(
    proposal: PlaybookProposal,
    reviewAction: 'edit' | 'approve' | 'reject',
  ) {
    try {
      await mutate(
        'proposal.review',
        {
          id: proposal.id,
          expected_lock_version: proposal.lock_version,
          review_action: reviewAction,
          edits: reviewAction === 'edit' ? proposalDraft : null,
        },
        reviewAction === 'approve'
          ? 'Suggestion approved. Update the procedure separately when ready.'
          : reviewAction === 'reject'
            ? 'Suggestion rejected. The procedure was not changed.'
            : 'Suggestion edits saved.',
      )
      setEditingProposal(false)
    } catch {
      /* error is displayed */
    }
  }

  async function applyProposal(proposal: PlaybookProposal) {
    const procedure = proposal.procedure_id
      ? procedureById.get(proposal.procedure_id)
      : null
    try {
      await mutate(
        'proposal.apply',
        {
          id: proposal.id,
          expected_lock_version: proposal.lock_version,
          expected_procedure_lock_version: procedure?.lock_version ?? null,
          change_summary: `Applied approved proposal: ${proposal.problem.slice(0, 160)}`,
        },
        'Approved change applied as a new procedure version.',
      )
      setDrawer(null)
    } catch {
      /* error is displayed */
    }
  }

  function openHistory(procedure: PlaybookProcedure) {
    const versions = (state?.versions ?? [])
      .filter((item) => item.procedure_id === procedure.id)
      .sort((a, b) => b.version_number - a.version_number)
    setHistoryToId(versions[0]?.id ?? '')
    setHistoryFromId(versions[1]?.id ?? versions[0]?.id ?? '')
    setDrawer({ kind: 'history', procedureId: procedure.id })
  }

  function taskOwner(task: PlaybookTask) {
    return task.person_id
      ? (personById.get(task.person_id)?.display_name ?? 'Unknown person')
      : task.role_id
        ? (roleById.get(task.role_id)?.name ?? 'Unknown role')
        : 'Unassigned'
  }

  function openTask(task: PlaybookTask | null, defaults?: Partial<TaskDraft>) {
    setTaskDraft(
      task
        ? {
            title: task.title,
            description: task.description,
            procedure_id: task.procedure_id ?? '',
            proposal_id: task.proposal_id ?? '',
            role_id: task.role_id ?? '',
            person_id: task.person_id ?? '',
            priority: task.priority,
            status: task.status,
          }
        : { ...EMPTY_TASK, ...defaults },
    )
    setDrawer({ kind: 'task', taskId: task?.id ?? null })
  }

  function openTaskForProposal(proposal: PlaybookProposal) {
    openTask(null, {
      title: proposal.proposed_snapshot.title,
      description: proposal.problem,
      procedure_id: proposal.procedure_id ?? '',
      proposal_id: proposal.id,
      role_id: proposal.suggested_role_id ?? '',
      priority: proposal.priority,
    })
  }

  async function saveTask() {
    if (drawer?.kind !== 'task') return
    try {
      if (drawer.taskId)
        await mutate(
          'task.update',
          {
            id: drawer.taskId,
            ...taskDraft,
            role_id: taskDraft.role_id || null,
            person_id: taskDraft.person_id || null,
          },
          'Task updated.',
        )
      else
        await mutate(
          'task.create',
          {
            ...taskDraft,
            procedure_id: taskDraft.procedure_id || null,
            proposal_id: taskDraft.proposal_id || null,
            role_id: taskDraft.role_id || null,
            person_id: taskDraft.person_id || null,
          },
          'Improvement task created.',
        )
      setDrawer(null)
    } catch {
      /* error is displayed */
    }
  }

  async function saveRole() {
    try {
      await mutate(
        roleDraft.id ? 'role.update' : 'role.create',
        roleDraft,
        roleDraft.id
          ? 'Role updated.'
          : 'Role added. No login account was created.',
      )
      setRoleDraft({
        id: '',
        name: '',
        department: 'General Operations',
        responsibilities: '',
      })
    } catch {
      /* error is displayed */
    }
  }

  async function savePerson() {
    try {
      await mutate(
        personDraft.id ? 'person.update' : 'person.create',
        { ...personDraft, role_id: personDraft.role_id || null },
        personDraft.id
          ? 'Directory entry updated.'
          : 'Employee directory entry added. No login account was created.',
      )
      setPersonDraft({
        id: '',
        display_name: '',
        job_title: '',
        department: 'General Operations',
        responsibilities: '',
        role_id: '',
      })
    } catch {
      /* error is displayed */
    }
  }

  function resetDemo() {
    if (
      mode !== 'demo' ||
      !window.confirm(
        'Reset all synthetic Playbook roles, procedures, proposals, and tasks?',
      )
    )
      return
    const next = createInitialPlaybookDemoState(workspaceId)
    storeDemo(next)
    setSelectedProcedureId(next.procedures[0]?.id ?? null)
    setView('procedures')
    setDrawer(null)
    setNotice('Synthetic Playbook demo reset.')
    setError(null)
  }

  if (loading)
    return (
      <div className={styles.loading} aria-label="Loading Business Playbook">
        <span />
        <span />
        <span />
      </div>
    )
  if (!state)
    return (
      <div className={styles.fatal}>
        <h1>Playbook could not load</h1>
        <p>{error}</p>
        <button
          className={styles.primaryButton}
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    )

  const drawerTitle =
    drawer?.kind === 'suggestion'
      ? 'Review suggestion'
      : drawer?.kind === 'history'
        ? 'Procedure history'
        : drawer?.kind === 'procedure'
          ? drawer.procedureId
            ? 'Edit procedure'
            : 'New procedure'
          : drawer?.kind === 'task'
            ? drawer.taskId
              ? 'Task details'
              : 'New task'
            : drawer?.kind === 'directory'
              ? 'People and roles'
              : ''

  return (
    <div className={styles.page} data-demo={mode === 'demo'}>
      <header className={styles.topbar}>
        <div>
          <span className={styles.kicker}>{workspaceName}</span>
          <h1>
            {view === 'review'
              ? 'Needs your review'
              : view === 'tasks'
                ? 'Tasks'
                : 'Business Playbook'}
          </h1>
        </div>
        <div className={styles.topActions}>
          {mode === 'demo' ? (
            <button
              type="button"
              className={styles.textButton}
              onClick={resetDemo}
            >
              Reset demo
            </button>
          ) : (
            <Link href="/dashboard/playbook/demo" className={styles.textButton}>
              Try sample playbook
            </Link>
          )}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => setDrawer({ kind: 'directory' })}
          >
            People & roles
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            title="Suggest playbook improvements"
            onClick={suggestImprovements}
            disabled={analysisLoading}
          >
            {analysisLoading ? 'Reviewing feedback…' : 'Find improvements'}
          </button>
        </div>
      </header>

      {mode === 'demo' ? (
        <details className={styles.safetyNote}>
          <summary>Synthetic demo · saved in this browser</summary>
          <p>
            Fictional people, procedures, suggestions, and tasks use the 60
            canonical sample feedback records. Nothing can publish externally.
          </p>
        </details>
      ) : (
        <details className={styles.safetyNote}>
          <summary>Owner-controlled changes</summary>
          <p>
            Suggestions remain pending until approval and require a separate
            update action before changing a procedure.
          </p>
        </details>
      )}

      {notice ? (
        <div className={styles.notice} role="status">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss message"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className={styles.error} role="alert">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}

      {view === 'procedures' ? (
        <div className={styles.procedureLayout}>
          <aside
            className={`${styles.library} ${libraryOpen ? styles.libraryOpen : ''}`}
            aria-label="Procedure library"
            aria-hidden={compactLibrary && !libraryOpen}
            inert={compactLibrary && !libraryOpen ? true : undefined}
          >
            <div className={styles.libraryHeader}>
              <div>
                <span>Procedure library</span>
                <strong>{state.procedures.length} procedures</strong>
              </div>
              <button
                type="button"
                onClick={() => setLibraryOpen(false)}
                aria-label="Close procedure library"
              >
                <CloseIcon />
              </button>
            </div>
            <label className={styles.searchField}>
              <SearchIcon />
              <span className={styles.srOnly}>Search procedures</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search procedures"
              />
            </label>
            <div className={styles.categoryList}>
              {categories.map((group) => {
                const collapsed = collapsedCategories.has(group.category)
                return (
                  <section key={group.category}>
                    <button
                      type="button"
                      className={styles.categoryButton}
                      aria-expanded={!collapsed}
                      onClick={() =>
                        setCollapsedCategories((current) => {
                          const next = new Set(current)
                          if (collapsed) next.delete(group.category)
                          else next.add(group.category)
                          return next
                        })
                      }
                    >
                      <span>{group.category}</span>
                      <small>{group.procedures.length}</small>
                    </button>
                    {!collapsed ? (
                      <div className={styles.procedureLinks}>
                        {group.procedures.map((procedure) => (
                          <button
                            type="button"
                            key={procedure.id}
                            className={
                              effectiveSelectedProcedureId === procedure.id
                                ? styles.procedureLinkActive
                                : undefined
                            }
                            onClick={() => openProcedure(procedure)}
                          >
                            <span>{procedure.title}</span>
                            {procedure.status === 'draft' ? (
                              <small>Draft</small>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </section>
                )
              })}
              {categories.length === 0 ? (
                <p className={styles.emptyLibrary}>
                  No procedures match “{search}”.
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className={styles.newProcedureButton}
              onClick={() => openProcedureForm(null)}
            >
              New procedure
            </button>
          </aside>
          {compactLibrary && libraryOpen ? (
            <button
              type="button"
              className={styles.libraryBackdrop}
              aria-label="Close procedure library"
              onClick={() => setLibraryOpen(false)}
            />
          ) : null}

          <main className={styles.reader}>
            <button
              type="button"
              className={styles.mobileLibraryButton}
              onClick={() => setLibraryOpen(true)}
            >
              Browse procedures
            </button>
            {selectedProcedure ? (
              <article className={styles.document}>
                <div className={styles.documentMeta}>
                  <span>{selectedProcedure.category}</span>
                  <i aria-hidden="true" />
                  <span>{humanStatus(selectedProcedure.status)}</span>
                  <i aria-hidden="true" />
                  <span>Version {selectedProcedure.current_version}</span>
                </div>
                <div className={styles.documentHeading}>
                  <div>
                    <h2>{selectedProcedure.title}</h2>
                    <p>
                      {selectedProcedure.description ||
                        'No summary has been added.'}
                    </p>
                  </div>
                  <div className={styles.documentMenu}>
                    <button
                      type="button"
                      onClick={() => openProcedureForm(selectedProcedure)}
                    >
                      Edit
                    </button>
                    <details className={styles.procedureOverflow}>
                      <summary aria-label="More procedure actions">More</summary>
                      <div role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open')
                            openHistory(selectedProcedure)
                          }}
                        >
                          Version history
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={(event) => {
                            event.currentTarget.closest('details')?.removeAttribute('open')
                            openTask(null, {
                              procedure_id: selectedProcedure.id,
                              title: `Follow up: ${selectedProcedure.title}`,
                            })
                          }}
                        >
                          Create task
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                {selectedSuggestion ? (
                  <button
                    type="button"
                    className={styles.suggestionNotice}
                    onClick={() => openSuggestion(selectedSuggestion)}
                  >
                    <span>
                      <strong>
                        {selectedSuggestion.status === 'approved'
                          ? 'Approved improvement ready'
                          : 'Suggested improvement'}
                      </strong>
                      <small>{selectedSuggestion.problem}</small>
                    </span>
                    <b>
                      {selectedSuggestion.status === 'approved'
                        ? 'Update procedure'
                        : 'Review'}
                    </b>
                  </button>
                ) : null}

                {selectedProcedure.objective ? (
                  <section className={styles.objective}>
                    <span>Purpose</span>
                    <p>{selectedProcedure.objective}</p>
                  </section>
                ) : null}
                <section className={styles.stepsSection}>
                  <div className={styles.sectionTitle}>
                    <span>Procedure</span>
                    <small>{selectedProcedure.steps.length} steps</small>
                  </div>
                  <ol>
                    {selectedProcedure.steps.map((step, index) => (
                      <li key={`${selectedProcedure.id}-${index}`}>
                        <b>{index + 1}</b>
                        <p>{step}</p>
                      </li>
                    ))}
                  </ol>
                </section>
                <footer className={styles.documentFooter}>
                  <div>
                    <span>Responsible role</span>
                    <strong>
                      {selectedProcedure.responsible_role_id
                        ? (roleById.get(selectedProcedure.responsible_role_id)
                            ?.name ?? 'Unknown role')
                        : 'Unassigned'}
                    </strong>
                  </div>
                  <div>
                    <span>Assigned person</span>
                    <strong>
                      {selectedProcedure.assigned_person_id
                        ? (personById.get(selectedProcedure.assigned_person_id)
                            ?.display_name ?? 'Unknown person')
                        : 'Role only'}
                    </strong>
                  </div>
                  <div>
                    <span>Last updated</span>
                    <strong>
                      {dateFormatter.format(
                        new Date(selectedProcedure.updated_at),
                      )}
                    </strong>
                  </div>
                </footer>
              </article>
            ) : (
              <div className={styles.emptyState}>
                <h2>No procedures yet</h2>
                <p>
                  Create the first procedure to give your team one trusted way
                  to work.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => openProcedureForm(null)}
                >
                  New procedure
                </button>
              </div>
            )}
          </main>
        </div>
      ) : null}

      {view === 'review' ? (
        <main className={styles.collectionView}>
          <div className={styles.collectionIntro}>
            <div>
              <span>Change queue</span>
              <h2>Review before anything changes</h2>
              <p>
                Approve or reject each suggestion. Approved changes still
                require a separate procedure update.
              </p>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={suggestImprovements}
              disabled={analysisLoading}
            >
              Refresh suggestions
            </button>
          </div>
          <div className={styles.reviewList}>
            {reviewQueue.map((proposal) => {
              const procedure = proposal.procedure_id
                ? procedureById.get(proposal.procedure_id)
                : null
              return (
                <button
                  type="button"
                  key={proposal.id}
                  onClick={() => openSuggestion(proposal)}
                >
                  <span
                    className={styles.priorityMark}
                    data-priority={proposal.priority}
                  />
                  <span>
                    <strong>{proposal.problem}</strong>
                    <small>
                      {procedure?.title ?? 'New procedure'} ·{' '}
                      {humanStatus(proposal.status)} ·{' '}
                      {proposalEvidence(proposal).length} feedback records
                    </small>
                  </span>
                  <b>
                    {proposal.status === 'approved'
                      ? 'Update procedure'
                      : 'Review'}
                  </b>
                </button>
              )
            })}
            {reviewQueue.length === 0 ? (
              <div className={styles.emptyState}>
                <h2>Nothing needs your review</h2>
                <p>
                  Run an improvement review when you want Replova to look for
                  recurring operational problems in authorized feedback.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={suggestImprovements}
                  disabled={analysisLoading}
                >
                  Find improvements
                </button>
              </div>
            ) : null}
          </div>
        </main>
      ) : null}

      {view === 'tasks' ? (
        <main className={styles.collectionView}>
          <div className={styles.collectionIntro}>
            <div>
              <span>Follow-up work</span>
              <h2>Tasks</h2>
              <p>Keep procedure improvements owned and moving.</p>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => openTask(null)}
            >
              New task
            </button>
          </div>
          <div
            className={styles.taskTable}
            role="table"
            aria-label="Playbook tasks"
          >
            <div className={styles.taskHeader} role="row">
              <span role="columnheader">Task</span>
              <span role="columnheader">Owner</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Priority</span>
            </div>
            {state.tasks.map((task) => (
              <button
                type="button"
                role="row"
                key={task.id}
                onClick={() => openTask(task)}
              >
                <span role="cell">
                  <strong>{task.title}</strong>
                  <small>
                    {task.procedure_id
                      ? procedureById.get(task.procedure_id)?.title
                      : 'General improvement'}
                  </small>
                </span>
                <span role="cell">{taskOwner(task)}</span>
                <span role="cell">{humanStatus(task.status)}</span>
                <span role="cell" data-priority={task.priority}>
                  {humanStatus(task.priority)}
                </span>
              </button>
            ))}
            {state.tasks.length === 0 ? (
              <div className={styles.emptyState}>
                <h2>No tasks yet</h2>
                <p>
                  Create a task directly or link one to an approved improvement.
                </p>
              </div>
            ) : null}
          </div>
        </main>
      ) : null}

      {drawer ? (
        <>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
          />
          <aside className={styles.drawer} aria-label={drawerTitle}>
            <header>
              <div>
                <span>Business Playbook</span>
                <h2>{drawerTitle}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                aria-label={`Close ${drawerTitle}`}
              >
                <CloseIcon />
              </button>
            </header>
            <div className={styles.drawerBody}>
              {drawer.kind === 'procedure' ? (
                <ProcedureForm
                  draft={procedureDraft}
                  setDraft={setProcedureDraft}
                  roles={state.roles}
                  people={state.people}
                  saving={saving}
                  editing={Boolean(drawer.procedureId)}
                  onCancel={() => setDrawer(null)}
                  onSubmit={saveProcedure}
                />
              ) : null}

              {drawer.kind === 'suggestion' && activeProposal
                ? (() => {
                    const existing = activeProposal.procedure_id
                      ? procedureById.get(activeProposal.procedure_id)
                      : null
                    const diff = compareSteps(
                      existing?.steps ?? [],
                      activeProposal.proposed_snapshot.steps,
                    )
                    const evidence = proposalEvidence(activeProposal)
                    return editingProposal && proposalDraft ? (
                      <form
                        className={styles.form}
                        onSubmit={(event) => {
                          event.preventDefault()
                          reviewProposal(activeProposal, 'edit')
                        }}
                      >
                        <label>
                          Reported problem
                          <textarea
                            value={proposalDraft.problem}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? { ...current, problem: event.target.value }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <label>
                          Why this may help
                          <textarea
                            value={proposalDraft.expected_benefit}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      expected_benefit: event.target.value,
                                    }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <label>
                          Reasoning
                          <textarea
                            value={proposalDraft.rationale}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      rationale: event.target.value,
                                    }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <div className={styles.formPair}>
                          <label>
                            Priority
                            <select
                              value={proposalDraft.priority}
                              onChange={(event) =>
                                setProposalDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        priority: event.target
                                          .value as PlaybookPriority,
                                      }
                                    : null,
                                )
                              }
                            >
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                          </label>
                          <label>
                            Responsible role
                            <select
                              value={proposalDraft.suggested_role_id ?? ''}
                              onChange={(event) =>
                                setProposalDraft((current) =>
                                  current
                                    ? {
                                        ...current,
                                        suggested_role_id:
                                          event.target.value || null,
                                        proposed_snapshot: {
                                          ...current.proposed_snapshot,
                                          responsible_role_id:
                                            event.target.value || null,
                                        },
                                      }
                                    : null,
                                )
                              }
                            >
                              <option value="">Unassigned</option>
                              {state.roles
                                .filter((role) => role.active)
                                .map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        </div>
                        <label>
                          Suggested title
                          <input
                            value={proposalDraft.proposed_snapshot.title}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      proposed_snapshot: {
                                        ...current.proposed_snapshot,
                                        title: event.target.value,
                                      },
                                    }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <label>
                          Suggested summary
                          <textarea
                            value={proposalDraft.proposed_snapshot.description}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      proposed_snapshot: {
                                        ...current.proposed_snapshot,
                                        description: event.target.value,
                                      },
                                    }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <label>
                          Suggested steps — one per line
                          <textarea
                            className={styles.stepsInput}
                            value={proposalDraft.proposed_snapshot.steps.join(
                              '\n',
                            )}
                            onChange={(event) =>
                              setProposalDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      proposed_snapshot: {
                                        ...current.proposed_snapshot,
                                        steps: event.target.value.split('\n'),
                                      },
                                    }
                                  : null,
                              )
                            }
                          />
                        </label>
                        <div className={styles.formActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setEditingProposal(false)}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className={styles.primaryButton}
                            disabled={saving}
                          >
                            Save edits
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className={styles.suggestionReview}>
                        <div className={styles.reviewStatus}>
                          <span data-status={activeProposal.status}>
                            {humanStatus(activeProposal.status)}
                          </span>
                          <small>
                            {humanStatus(activeProposal.priority)} priority ·{' '}
                            {dateFormatter.format(
                              new Date(activeProposal.created_at),
                            )}
                          </small>
                        </div>
                        <section>
                          <span>Reported problem</span>
                          <h3>{activeProposal.problem}</h3>
                          <p>{activeProposal.rationale}</p>
                        </section>
                        <div className={styles.comparison}>
                          <section>
                            <span>Current</span>
                            <strong>
                              {existing?.title ?? 'No existing procedure'}
                            </strong>
                            <p>
                              {existing?.description ||
                                'This suggestion would create a new procedure.'}
                            </p>
                          </section>
                          <section>
                            <span>Suggested</span>
                            <strong>
                              {activeProposal.proposed_snapshot.title}
                            </strong>
                            <p>
                              {activeProposal.proposed_snapshot.description}
                            </p>
                          </section>
                        </div>
                        <section className={styles.changeList}>
                          <span>What changes</span>
                          {diff.additions.map((step, index) => (
                            <p key={`add-${index}`} data-change="add">
                              <b>Added</b>
                              {step}
                            </p>
                          ))}
                          {diff.removals.map((step, index) => (
                            <p key={`remove-${index}`} data-change="remove">
                              <b>Removed</b>
                              {step}
                            </p>
                          ))}
                          {diff.additions.length === 0 &&
                          diff.removals.length === 0 ? (
                            <p>
                              No step-level changes; review the title, summary,
                              purpose, or ownership above.
                            </p>
                          ) : null}
                        </section>
                        <section>
                          <span>Expected result</span>
                          <p>{activeProposal.expected_benefit}</p>
                        </section>
                        <details className={styles.evidence}>
                          <summary>
                            Supporting feedback <small>{evidence.length}</small>
                          </summary>
                          <div>
                            {evidence.map((item) => (
                              <article key={item.review_id}>
                                <div>
                                  <strong>
                                    {item.rating > 0
                                      ? `${item.rating}/5`
                                      : 'Feedback'}
                                  </strong>
                                  <code>{item.review_id}</code>
                                </div>
                                <p>{item.text}</p>
                                <small>
                                  {mode === 'demo'
                                    ? 'Synthetic sample feedback'
                                    : 'Authorized workspace feedback'}{' '}
                                  ·{' '}
                                  {item.received_at
                                    ? dateFormatter.format(
                                        new Date(item.received_at),
                                      )
                                    : 'Date unavailable'}
                                </small>
                              </article>
                            ))}
                          </div>
                        </details>
                        <div className={styles.drawerActions}>
                          {activeProposal.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                className={styles.textButton}
                                onClick={() => setEditingProposal(true)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() =>
                                  reviewProposal(activeProposal, 'reject')
                                }
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                aria-label="Approve proposal"
                                onClick={() =>
                                  reviewProposal(activeProposal, 'approve')
                                }
                              >
                                Approve suggestion
                              </button>
                            </>
                          ) : null}
                          {activeProposal.status === 'approved' ? (
                            <>
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                onClick={() =>
                                  openTaskForProposal(activeProposal)
                                }
                              >
                                Create linked task
                              </button>
                              <button
                                type="button"
                                className={styles.primaryButton}
                                title="Apply as new version"
                                onClick={() => applyProposal(activeProposal)}
                              >
                                Update procedure
                              </button>
                            </>
                          ) : null}
                          {activeProposal.status === 'rejected' ? (
                            <p>
                              This suggestion remains in history. The procedure
                              was not changed.
                            </p>
                          ) : null}
                          {activeProposal.status === 'applied' ? (
                            <p>
                              This approved suggestion was applied as an
                              auditable procedure version.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })()
                : null}

              {drawer.kind === 'history' && historyProcedure ? (
                <div className={styles.historyPanel}>
                  <p className={styles.panelLead}>
                    Every saved version of{' '}
                    <strong>{historyProcedure.title}</strong> remains readable
                    and immutable.
                  </p>
                  {historyVersions.length > 1 ? (
                    <div className={styles.versionSelectors}>
                      <label>
                        From
                        <select
                          value={historyFromId}
                          onChange={(event) =>
                            setHistoryFromId(event.target.value)
                          }
                        >
                          {historyVersions.map((version) => (
                            <option key={version.id} value={version.id}>
                              Version {version.version_number}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        To
                        <select
                          value={historyToId}
                          onChange={(event) =>
                            setHistoryToId(event.target.value)
                          }
                        >
                          {historyVersions.map((version) => (
                            <option key={version.id} value={version.id}>
                              Version {version.version_number}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {historyVersions.length > 1 && historyFrom && historyTo
                    ? (() => {
                        const diff = compareSteps(
                          historyFrom.snapshot.steps,
                          historyTo.snapshot.steps,
                        )
                        return (
                          <section className={styles.versionDiff}>
                            <span>Comparison</span>
                            {diff.additions.map((step, index) => (
                              <p key={`h-add-${index}`} data-change="add">
                                <b>Added</b>
                                {step}
                              </p>
                            ))}
                            {diff.removals.map((step, index) => (
                              <p key={`h-remove-${index}`} data-change="remove">
                                <b>Removed</b>
                                {step}
                              </p>
                            ))}
                            {diff.additions.length === 0 &&
                            diff.removals.length === 0 ? (
                              <p>
                                No step-level differences between these
                                versions.
                              </p>
                            ) : null}
                          </section>
                        )
                      })()
                    : null}
                  <div className={styles.versionList}>
                    {historyVersions.map((version) => (
                      <VersionRecord key={version.id} version={version} />
                    ))}
                  </div>
                  {(state.proposals ?? []).filter(
                    (item) =>
                      item.procedure_id === historyProcedure.id &&
                      (item.status === 'rejected' || item.status === 'applied'),
                  ).length ? (
                    <section className={styles.decisionHistory}>
                      <span>Suggestion decisions</span>
                      {state.proposals
                        .filter(
                          (item) =>
                            item.procedure_id === historyProcedure.id &&
                            (item.status === 'rejected' ||
                              item.status === 'applied'),
                        )
                        .map((item) => (
                          <article key={item.id}>
                            <strong>{humanStatus(item.status)}</strong>
                            <p>{item.problem}</p>
                            <small>
                              {dateFormatter.format(new Date(item.updated_at))}
                            </small>
                          </article>
                        ))}
                    </section>
                  ) : null}
                </div>
              ) : null}

              {drawer.kind === 'task' ? (
                <form
                  className={styles.form}
                  onSubmit={(event) => {
                    event.preventDefault()
                    saveTask()
                  }}
                >
                  {taskDraft.procedure_id || taskDraft.proposal_id ? (
                    <div className={styles.linkedContext}>
                      <span>Linked work</span>
                      <strong>
                        {taskDraft.procedure_id
                          ? (procedureById.get(taskDraft.procedure_id)?.title ??
                            'Procedure')
                          : 'Approved improvement'}
                      </strong>
                      {taskDraft.proposal_id ? (
                        <small>Created from a playbook suggestion</small>
                      ) : null}
                    </div>
                  ) : null}
                  <label>
                    Task title
                    <input
                      required
                      minLength={3}
                      maxLength={220}
                      value={taskDraft.title}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Notes (optional)
                    <textarea
                      maxLength={2000}
                      value={taskDraft.description}
                      onChange={(event) =>
                        setTaskDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Owner
                    <select
                      value={
                        taskDraft.person_id
                          ? `person:${taskDraft.person_id}`
                          : taskDraft.role_id
                            ? `role:${taskDraft.role_id}`
                            : ''
                      }
                      onChange={(event) => {
                        const [kind, id = ''] = event.target.value.split(':')
                        setTaskDraft((current) => ({
                          ...current,
                          person_id: kind === 'person' ? id : '',
                          role_id: kind === 'role' ? id : '',
                        }))
                      }}
                    >
                      <option value="">Unassigned</option>
                      <optgroup label="People">
                        {state.people
                          .filter((item) => item.active)
                          .map((item) => (
                            <option key={item.id} value={`person:${item.id}`}>
                              {item.display_name}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Roles">
                        {state.roles
                          .filter((item) => item.active)
                          .map((item) => (
                            <option key={item.id} value={`role:${item.id}`}>
                              {item.name}
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </label>
                  <div className={styles.formPair}>
                    <label>
                      Status
                      <select
                        value={taskDraft.status}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            status: event.target.value as PlaybookTaskStatus,
                          }))
                        }
                      >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    </label>
                    <label>
                      Priority
                      <select
                        value={taskDraft.priority}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            priority: event.target.value as PlaybookPriority,
                          }))
                        }
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                  </div>
                  {!activeTask && !taskDraft.procedure_id ? (
                    <label>
                      Related procedure (optional)
                      <select
                        value={taskDraft.procedure_id}
                        onChange={(event) =>
                          setTaskDraft((current) => ({
                            ...current,
                            procedure_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">General improvement</option>
                        {state.procedures.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setDrawer(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={saving}
                    >
                      {drawer.taskId ? 'Save task' : 'Create task'}
                    </button>
                  </div>
                </form>
              ) : null}

              {drawer.kind === 'directory' ? (
                <div className={styles.directory}>
                  <nav aria-label="Directory sections">
                    <button
                      type="button"
                      aria-current={
                        directorySection === 'roles' ? 'page' : undefined
                      }
                      onClick={() => setDirectorySection('roles')}
                    >
                      Roles
                    </button>
                    <button
                      type="button"
                      aria-current={
                        directorySection === 'people' ? 'page' : undefined
                      }
                      onClick={() => setDirectorySection('people')}
                    >
                      People
                    </button>
                  </nav>
                  <p className={styles.formNote}>
                    These are responsibility records only. Adding a person does
                    not create a login account or send an invitation.
                  </p>
                  {directorySection === 'roles' ? (
                    <>
                      <form
                        className={styles.form}
                        onSubmit={(event) => {
                          event.preventDefault()
                          saveRole()
                        }}
                      >
                        <label>
                          Role name
                          <input
                            required
                            minLength={2}
                            value={roleDraft.name}
                            onChange={(event) =>
                              setRoleDraft((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Department
                          <input
                            required
                            minLength={2}
                            value={roleDraft.department}
                            onChange={(event) =>
                              setRoleDraft((current) => ({
                                ...current,
                                department: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          Responsibilities
                          <textarea
                            value={roleDraft.responsibilities}
                            onChange={(event) =>
                              setRoleDraft((current) => ({
                                ...current,
                                responsibilities: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className={styles.formActions}>
                          {roleDraft.id ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() =>
                                setRoleDraft({
                                  id: '',
                                  name: '',
                                  department: 'General Operations',
                                  responsibilities: '',
                                })
                              }
                            >
                              Cancel
                            </button>
                          ) : null}
                          <button
                            type="submit"
                            className={styles.primaryButton}
                          >
                            {roleDraft.id ? 'Save role' : 'Add role'}
                          </button>
                        </div>
                      </form>
                      <div className={styles.directoryList}>
                        {state.roles.map((role) => (
                          <article key={role.id} data-inactive={!role.active}>
                            <div>
                              <strong>{role.name}</strong>
                              <small>{role.department}</small>
                              <p>
                                {role.responsibilities ||
                                  'No responsibilities recorded.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRoleDraft({
                                  id: role.id,
                                  name: role.name,
                                  department: role.department,
                                  responsibilities: role.responsibilities,
                                })
                              }
                            >
                              Edit
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : null}
                  {directorySection === 'people' ? (
                    <>
                      <form
                        className={styles.form}
                        onSubmit={(event) => {
                          event.preventDefault()
                          savePerson()
                        }}
                      >
                        <label>
                          Name
                          <input
                            required
                            minLength={2}
                            value={personDraft.display_name}
                            onChange={(event) =>
                              setPersonDraft((current) => ({
                                ...current,
                                display_name: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className={styles.formPair}>
                          <label>
                            Job title
                            <input
                              required
                              minLength={2}
                              value={personDraft.job_title}
                              onChange={(event) =>
                                setPersonDraft((current) => ({
                                  ...current,
                                  job_title: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label>
                            Department
                            <input
                              required
                              minLength={2}
                              value={personDraft.department}
                              onChange={(event) =>
                                setPersonDraft((current) => ({
                                  ...current,
                                  department: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                        <label>
                          Role
                          <select
                            value={personDraft.role_id}
                            onChange={(event) =>
                              setPersonDraft((current) => ({
                                ...current,
                                role_id: event.target.value,
                              }))
                            }
                          >
                            <option value="">No linked role</option>
                            {state.roles
                              .filter((role) => role.active)
                              .map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Responsibilities
                          <textarea
                            value={personDraft.responsibilities}
                            onChange={(event) =>
                              setPersonDraft((current) => ({
                                ...current,
                                responsibilities: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <div className={styles.formActions}>
                          {personDraft.id ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() =>
                                setPersonDraft({
                                  id: '',
                                  display_name: '',
                                  job_title: '',
                                  department: 'General Operations',
                                  responsibilities: '',
                                  role_id: '',
                                })
                              }
                            >
                              Cancel
                            </button>
                          ) : null}
                          <button
                            type="submit"
                            className={styles.primaryButton}
                          >
                            {personDraft.id ? 'Save person' : 'Add person'}
                          </button>
                        </div>
                      </form>
                      <div className={styles.directoryList}>
                        {state.people.map((person) => (
                          <article
                            key={person.id}
                            data-inactive={!person.active}
                          >
                            <div>
                              <strong>{person.display_name}</strong>
                              <small>
                                {person.job_title} · {person.department}
                              </small>
                              <p>
                                {person.responsibilities ||
                                  'No individual responsibilities recorded.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPersonDraft({
                                  id: person.id,
                                  display_name: person.display_name,
                                  job_title: person.job_title,
                                  department: person.department,
                                  responsibilities: person.responsibilities,
                                  role_id: person.role_id ?? '',
                                })
                              }
                            >
                              Edit
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  )
}

function VersionRecord({ version }: { version: PlaybookVersion }) {
  return (
    <details>
      <summary>
        <span>Version {version.version_number}</span>
        <small>{dateFormatter.format(new Date(version.created_at))}</small>
      </summary>
      <div>
        <strong>{version.change_summary}</strong>
        <p>
          {version.approved_by ? 'Owner-approved version' : 'Draft version'} ·{' '}
          {version.source === 'ai_proposal'
            ? 'From approved suggestion'
            : 'Manual change'}
        </p>
        <ol>
          {version.snapshot.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </div>
    </details>
  )
}
