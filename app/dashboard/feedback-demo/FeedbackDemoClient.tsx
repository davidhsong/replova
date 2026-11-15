'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  calculateFeedbackDemoMetrics,
  createInitialFeedbackDemoState,
  FEEDBACK_DEMO_BUSINESS_NAME,
  FEEDBACK_DEMO_DATASET_VERSION,
  FEEDBACK_DEMO_LABEL,
  isFeedbackDemoState,
  type DemoFeedbackAnalysis,
  type DemoFeedbackEntry,
  type DemoImprovementTask,
  type DemoTaskPriority,
  type DemoTaskStatus,
  type FeedbackDemoState,
  type FeedbackFollowUpStatus,
  type FeedbackIssueStatus,
} from '@/lib/feedbackDemo'
import styles from './FeedbackDemo.module.css'

interface Props {
  workspaceId: string
  ownerWorkspaceName: string
  storageKey: string
}

type TaskDraft = {
  title: string
  owner: string
  priority: DemoTaskPriority
  linkedFindingId: string | null
}

const taskOwners = ['Shop owner', 'Service advisor', 'Lead technician', 'Front desk']

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

function isDemoAnalysis(value: unknown): value is DemoFeedbackAnalysis {
  if (!value || typeof value !== 'object') return false
  const analysis = value as Partial<DemoFeedbackAnalysis>
  return typeof analysis.executiveSummary === 'string'
    && Array.isArray(analysis.findings)
    && analysis.findings.length >= 3
    && Array.isArray(analysis.themes)
    && typeof analysis.generatedAt === 'string'
}

function labelIssueStatus(status: FeedbackIssueStatus) {
  if (status === 'in_progress') return 'In progress'
  if (status === 'resolved') return 'Resolved'
  if (status === 'new') return 'New issue'
  return 'No recovery needed'
}

function labelFollowUp(status: FeedbackFollowUpStatus) {
  const labels: Record<FeedbackFollowUpStatus, string> = {
    not_needed: 'Not needed',
    not_started: 'Not started',
    contacted: 'Customer contacted',
    awaiting_reply: 'Awaiting customer',
    confirmed_resolved: 'Customer confirmed',
  }
  return labels[status]
}

function LoadingState() {
  return (
    <div className={styles.loading} aria-label="Loading synthetic feedback demo">
      <div className={styles.loadingHeader} />
      <div className={styles.loadingMetrics}>
        {[0, 1, 2, 3].map(item => <div key={item} />)}
      </div>
      <div className={styles.loadingBody} />
    </div>
  )
}

export default function FeedbackDemoClient({ workspaceId, ownerWorkspaceName, storageKey }: Props) {
  const [state, setState] = useState<FeedbackDemoState | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [openFindingId, setOpenFindingId] = useState<string | null>(null)
  const [issueStatus, setIssueStatus] = useState<FeedbackIssueStatus>('new')
  const [followUpStatus, setFollowUpStatus] = useState<FeedbackFollowUpStatus>('not_started')
  const [resolutionNote, setResolutionNote] = useState('')
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: '',
    owner: 'Shop owner',
    priority: 'medium',
    linkedFindingId: null,
  })
  const recoveryCloseRef = useRef<HTMLButtonElement>(null)
  const recoveryDrawerRef = useRef<HTMLElement>(null)
  const recoveryTriggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(storageKey)
        if (stored) {
          const parsed: unknown = JSON.parse(stored)
          if (isFeedbackDemoState(parsed)) {
            setState(parsed)
            return
          }
        }
      } catch {
        // A corrupt local demo snapshot should never block the resettable demo.
      }
      setState(createInitialFeedbackDemoState())
    }, 0)
    return () => window.clearTimeout(loadTimer)
  }, [storageKey])

  useEffect(() => {
    if (!state) return
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  }, [state, storageKey])

  useEffect(() => {
    function closeRecoveryForAssistant() {
      setSelectedIssueId(null)
      window.requestAnimationFrame(() => recoveryTriggerRef.current?.focus())
    }

    window.addEventListener('replova:close-feedback-recovery', closeRecoveryForAssistant)
    return () => window.removeEventListener('replova:close-feedback-recovery', closeRecoveryForAssistant)
  }, [])

  useEffect(() => {
    if (!selectedIssueId) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFrame = window.requestAnimationFrame(() => recoveryCloseRef.current?.focus())

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedIssueId(null)
        window.requestAnimationFrame(() => recoveryTriggerRef.current?.focus())
        return
      }

      if (event.key !== 'Tab' || !recoveryDrawerRef.current) return
      const focusable = Array.from(recoveryDrawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [selectedIssueId])

  const selectedIssue = useMemo(
    () => state?.feedback.find(entry => entry.id === selectedIssueId) ?? null,
    [selectedIssueId, state]
  )

  const metrics = useMemo(
    () => state ? calculateFeedbackDemoMetrics(state) : null,
    [state]
  )

  const feedbackById = useMemo(
    () => new Map((state?.feedback ?? []).map(entry => [entry.id, entry])),
    [state]
  )

  const unresolvedIssues = useMemo(
    () => (state?.feedback ?? [])
      .filter(entry => entry.requiresRecovery && entry.issueStatus !== 'resolved')
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    [state]
  )

  const recentFeedback = useMemo(
    () => [...(state?.feedback ?? [])]
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
      .slice(0, 8),
    [state]
  )

  if (!state || !metrics) return <LoadingState />

  function updateFeedback(id: string, update: Partial<DemoFeedbackEntry>) {
    setState(current => current ? {
      ...current,
      feedback: current.feedback.map(entry => entry.id === id ? { ...entry, ...update } : entry),
    } : current)
  }

  function openRecovery(entry: DemoFeedbackEntry, trigger?: HTMLButtonElement) {
    window.dispatchEvent(new CustomEvent('replova:close-assistant'))
    if (trigger) recoveryTriggerRef.current = trigger
    setSelectedIssueId(entry.id)
    setIssueStatus(entry.issueStatus)
    setFollowUpStatus(entry.followUpStatus)
    setResolutionNote(entry.resolutionNote)
  }

  function closeRecovery() {
    setSelectedIssueId(null)
    window.requestAnimationFrame(() => recoveryTriggerRef.current?.focus())
  }

  async function runAnalysis() {
    if (analysisLoading) return
    setAnalysisLoading(true)
    setAnalysisError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/feedback-demo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          datasetVersion: FEEDBACK_DEMO_DATASET_VERSION,
        }),
      })
      const payload: unknown = await response.json().catch(() => null)
      const errorMessage = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'Replova could not analyze the demo feedback.'
      if (!response.ok) throw new Error(errorMessage)
      const analysis = payload && typeof payload === 'object' && 'analysis' in payload ? payload.analysis : null
      if (!isDemoAnalysis(analysis)) throw new Error('AI returned an incomplete analysis. Try again.')
      setState(current => current ? { ...current, analysis } : current)
      setNotice('AI analysis refreshed from all 60 synthetic feedback records.')
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'AI analysis failed.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  function saveRecovery() {
    if (!selectedIssue) return
    if (issueStatus === 'resolved' && resolutionNote.trim().length < 8) {
      setNotice(null)
      setAnalysisError('Add a short resolution note before marking this issue resolved.')
      return
    }
    updateFeedback(selectedIssue.id, {
      issueStatus,
      followUpStatus,
      resolutionNote: resolutionNote.trim().slice(0, 800),
    })
    setAnalysisError(null)
    setNotice(`Recovery record saved for ${selectedIssue.customerName}.`)
  }

  function prepareTaskFromFinding(findingId: string, recommendation: string, priority: DemoTaskPriority) {
    setTaskDraft({
      title: recommendation,
      owner: 'Shop owner',
      priority,
      linkedFindingId: findingId,
    })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('feedback-demo-task-form')?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'center',
    })
  }

  function createTask() {
    const title = taskDraft.title.trim().replace(/\s+/g, ' ').slice(0, 220)
    if (title.length < 5) {
      setAnalysisError('Enter a specific improvement task.')
      return
    }
    const now = new Date().toISOString()
    const task: DemoImprovementTask = {
      id: `task-${crypto.randomUUID()}`,
      title,
      owner: taskDraft.owner,
      priority: taskDraft.priority,
      status: 'todo',
      linkedFindingId: taskDraft.linkedFindingId,
      createdAt: now,
      completedAt: null,
    }
    setState(current => current ? { ...current, tasks: [task, ...current.tasks] } : current)
    setTaskDraft({ title: '', owner: 'Shop owner', priority: 'medium', linkedFindingId: null })
    setAnalysisError(null)
    setNotice('Improvement task created.')
  }

  function updateTask(id: string, update: Partial<DemoImprovementTask>) {
    setState(current => current ? {
      ...current,
      tasks: current.tasks.map(task => {
        if (task.id !== id) return task
        const next = { ...task, ...update }
        if (update.status) {
          next.completedAt = update.status === 'done' ? (task.completedAt ?? new Date().toISOString()) : null
        }
        return next
      }),
    } : current)
  }

  function resetDemo() {
    if (!window.confirm('Reset all synthetic feedback, recovery notes, AI findings, and improvement tasks to the original demo state?')) return
    const resetState = createInitialFeedbackDemoState()
    window.localStorage.setItem(storageKey, JSON.stringify(resetState))
    setState(resetState)
    setSelectedIssueId(null)
    setOpenFindingId(null)
    setTaskDraft({ title: '', owner: 'Shop owner', priority: 'medium', linkedFindingId: null })
    setAnalysisError(null)
    setNotice('Demo reset to the original 60 synthetic feedback records.')
  }

  const sentimentTotal = metrics.totalFeedback || 1
  const topFindings = state.analysis?.findings.slice(0, 3) ?? []

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <span>Feedback operations</span>
            <span className={styles.demoBadge}>{FEEDBACK_DEMO_LABEL}</span>
          </div>
          <h1>{FEEDBACK_DEMO_BUSINESS_NAME}</h1>
          <p>
            A fictional one-location auto service workspace inside <strong>{ownerWorkspaceName}</strong>.
            Every customer, visit, and outcome on this page is synthetic.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className="btn btn-ghost" onClick={resetDemo}>Reset demo</button>
          <button type="button" className="btn btn-primary" onClick={runAnalysis} disabled={analysisLoading}>
            {analysisLoading ? 'Analyzing 60 entries…' : state.analysis ? 'Refresh AI analysis' : 'Analyze with AI'}
          </button>
        </div>
      </header>

      <main className={styles.body}>
        <div className={styles.safetyNote}>
          <span>Demo boundary</span>
          Synthetic feedback is stored only in this browser. Nothing here can publish to Google, YouTube, or another external platform.
        </div>

        {notice && <div className={styles.success} role="status">{notice}</div>}
        {analysisError && <div className={styles.error} role="alert">{analysisError}</div>}

        <section className={styles.metrics} aria-label="Feedback operations metrics">
          <article>
            <span>New feedback</span>
            <strong>{metrics.newFeedback}</strong>
            <small>received in the last 7 days</small>
          </article>
          <article className={metrics.unresolvedIssues > 0 ? styles.metricAttention : undefined}>
            <span>Unresolved issues</span>
            <strong>{metrics.unresolvedIssues}</strong>
            <small>of {metrics.issueCount} recovery cases</small>
          </article>
          <article>
            <span>Resolution rate</span>
            <strong>{metrics.resolutionRate}%</strong>
            <small>{metrics.resolvedIssues} customer issues resolved</small>
          </article>
          <article>
            <span>Improvement tasks</span>
            <strong>{metrics.completedTasks}/{metrics.totalTasks}</strong>
            <small>completed in this demo</small>
          </article>
        </section>

        <section className={styles.primaryGrid}>
          <div className={styles.findingsPanel} id="feedback-priorities">
            <div className={styles.sectionHeading}>
              <div>
                <span>AI operational review</span>
                <h2>Top three recommended improvements</h2>
              </div>
              {state.analysis && (
                <small>Generated {dateFormatter.format(new Date(state.analysis.generatedAt))}</small>
              )}
            </div>

            {analysisLoading && (
              <div className={styles.analysisLoading} aria-live="polite">
                <span />
                <div>
                  <strong>Grouping recurring issues</strong>
                  <p>Replova is tracing each finding back to the synthetic feedback that supports it.</p>
                </div>
              </div>
            )}

            {!analysisLoading && !state.analysis && (
              <div className={styles.analysisEmpty}>
                <strong>Run the first operational analysis</strong>
                <p>The real Replova AI service will group recurring issues, cite supporting records, and recommend three shop-process changes.</p>
                <button type="button" className="btn btn-primary" onClick={runAnalysis}>Analyze synthetic feedback</button>
              </div>
            )}

            {!analysisLoading && state.analysis && (
              <>
                <p className={styles.executiveSummary}>{state.analysis.executiveSummary}</p>
                <div className={styles.findingList}>
                  {topFindings.map((finding, index) => {
                    const evidence = finding.supportingFeedbackIds
                      .map(id => feedbackById.get(id))
                      .filter((entry): entry is DemoFeedbackEntry => Boolean(entry))
                    const isOpen = openFindingId === finding.id
                    return (
                      <article key={finding.id} className={styles.finding} style={{ '--finding-index': index } as React.CSSProperties}>
                        <div className={styles.findingTopline}>
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <span data-severity={finding.severity}>{finding.severity} priority</span>
                        </div>
                        <h3>{finding.title}</h3>
                        <p>{finding.summary}</p>
                        <div className={styles.recommendation}>
                          <span>Recommended test</span>
                          <strong>{finding.recommendation}</strong>
                        </div>
                        <div className={styles.findingActions}>
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`finding-evidence-${finding.id}`}
                            onClick={() => setOpenFindingId(isOpen ? null : finding.id)}
                          >
                            {isOpen ? 'Hide evidence' : `View ${evidence.length} supporting entries`}
                          </button>
                          <button
                            type="button"
                            onClick={() => prepareTaskFromFinding(
                              finding.id,
                              finding.recommendation,
                              finding.severity === 'high' ? 'high' : finding.severity === 'medium' ? 'medium' : 'low'
                            )}
                          >
                            Create task
                          </button>
                        </div>
                        {isOpen && (
                          <div className={styles.evidenceList} id={`finding-evidence-${finding.id}`}>
                            {evidence.map(entry => (
                              <div key={entry.id}>
                                <div>
                                  <strong>{entry.customerName}</strong>
                                  <span>{entry.rating}/5 · {entry.service}</span>
                                </div>
                                <p>{entry.text}</p>
                                <small>Synthetic demo record · {entry.id}</small>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <aside className={styles.recoveryPanel} id="customer-recovery">
            <div className={styles.sectionHeading}>
              <div>
                <span>Customer recovery</span>
                <h2>Issues needing action</h2>
              </div>
              <small>{unresolvedIssues.length} open</small>
            </div>
            <div className={styles.issueList}>
              {unresolvedIssues.map(entry => (
                <button
                  key={entry.id}
                  type="button"
                  className={selectedIssueId === entry.id ? styles.issueSelected : undefined}
                  aria-haspopup="dialog"
                  onClick={event => openRecovery(entry, event.currentTarget)}
                >
                  <span data-rating={entry.rating <= 1 ? 'critical' : 'attention'}>{entry.rating}/5</span>
                  <div>
                    <strong>{entry.customerName}</strong>
                    <p>{entry.text}</p>
                    <small>{labelIssueStatus(entry.issueStatus)} · {dateFormatter.format(new Date(entry.receivedAt))}</small>
                  </div>
                </button>
              ))}
            </div>

            <div className={styles.recoveryHint}>
              Select an issue to open its recovery record. The editor stays visible while you update follow-up and resolution details.
            </div>
          </aside>
        </section>

        <section className={styles.insightGrid}>
          <div className={styles.sentimentPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span>Feedback signal</span>
                <h2>Sentiment mix</h2>
              </div>
              <small>{metrics.totalFeedback} records</small>
            </div>
            <div className={styles.sentimentBar} aria-label={`${metrics.sentiment.positive} positive, ${metrics.sentiment.neutral} neutral, ${metrics.sentiment.negative} negative`}>
              <span data-tone="positive" style={{ width: `${(metrics.sentiment.positive / sentimentTotal) * 100}%` }} />
              <span data-tone="neutral" style={{ width: `${(metrics.sentiment.neutral / sentimentTotal) * 100}%` }} />
              <span data-tone="negative" style={{ width: `${(metrics.sentiment.negative / sentimentTotal) * 100}%` }} />
            </div>
            <div className={styles.sentimentLegend}>
              <div><span data-tone="positive" /><strong>{metrics.sentiment.positive}</strong><small>Positive</small></div>
              <div><span data-tone="neutral" /><strong>{metrics.sentiment.neutral}</strong><small>Neutral</small></div>
              <div><span data-tone="negative" /><strong>{metrics.sentiment.negative}</strong><small>Negative</small></div>
            </div>
          </div>

          <div className={styles.themePanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span>Recurring patterns</span>
                <h2>AI themes</h2>
              </div>
            </div>
            {state.analysis ? (
              <div className={styles.themeList}>
                {state.analysis.themes.slice(0, 6).map(theme => (
                  <div key={theme.id}>
                    <span data-sentiment={theme.sentiment}>{theme.supportingFeedbackIds.length}</span>
                    <div>
                      <strong>{theme.name}</strong>
                      <p>{theme.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.themeEmpty}>Run AI analysis to group recurring feedback and connect each theme to its supporting records.</p>
            )}
          </div>
        </section>

        <section className={styles.taskSection} id="improvement-tasks">
          <div className={styles.sectionHeading}>
            <div>
              <span>Operational follow-through</span>
              <h2>Improvement tasks</h2>
            </div>
            <small>{metrics.completedTasks} complete · {metrics.totalTasks - metrics.completedTasks} active</small>
          </div>
          <div className={styles.taskGrid}>
            <div className={styles.taskList}>
              <div className={styles.taskTableHeader} aria-hidden="true">
                <span>Complete</span>
                <span>Improvement</span>
                <span>Owner</span>
                <span>Priority</span>
                <span>Status</span>
              </div>
              {state.tasks.map(task => (
                <article key={task.id} data-status={task.status}>
                  <button
                    type="button"
                    className={styles.taskCheck}
                    aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                    onClick={() => updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done' })}
                  >
                    {task.status === 'done' ? 'Done' : 'Mark done'}
                  </button>
                  <div className={styles.taskCopy}>
                    <strong>{task.title}</strong>
                    <span>Created {dateFormatter.format(new Date(task.createdAt))}</span>
                  </div>
                  <label>
                    <span>Owner</span>
                    <select value={task.owner} onChange={event => updateTask(task.id, { owner: event.target.value })}>
                      {taskOwners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Priority</span>
                    <select value={task.priority} onChange={event => updateTask(task.id, { priority: event.target.value as DemoTaskPriority })}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select value={task.status} onChange={event => updateTask(task.id, { status: event.target.value as DemoTaskStatus })}>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Complete</option>
                    </select>
                  </label>
                </article>
              ))}
            </div>

            <div className={styles.taskForm} id="feedback-demo-task-form">
              <span>Create improvement task</span>
              <label>
                Task
                <textarea
                  value={taskDraft.title}
                  onChange={event => setTaskDraft(current => ({ ...current, title: event.target.value }))}
                  maxLength={220}
                  placeholder="Describe one observable process change."
                />
              </label>
              <div>
                <label>
                  Assign to
                  <select value={taskDraft.owner} onChange={event => setTaskDraft(current => ({ ...current, owner: event.target.value }))}>
                    {taskOwners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </label>
                <label>
                  Priority
                  <select value={taskDraft.priority} onChange={event => setTaskDraft(current => ({ ...current, priority: event.target.value as DemoTaskPriority }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
              </div>
              {taskDraft.linkedFindingId && <small>Linked to {taskDraft.linkedFindingId}</small>}
              <button type="button" className="btn btn-primary btn-block" onClick={createTask}>Create task</button>
            </div>
          </div>
        </section>

        <section className={styles.feedbackSection}>
          <div className={styles.sectionHeading}>
            <div>
              <span>Latest input</span>
              <h2>New feedback</h2>
            </div>
            <small>Showing 8 of {metrics.totalFeedback}</small>
          </div>
          <div className={styles.feedbackList}>
            {recentFeedback.map(entry => (
              <article key={entry.id}>
                <div className={styles.feedbackMeta}>
                  <span data-sentiment={entry.sentiment}>{entry.rating}/5</span>
                  <div>
                    <strong>{entry.customerName}</strong>
                    <small>{entry.service} · {entry.channel} · {dateFormatter.format(new Date(entry.receivedAt))}</small>
                  </div>
                  <em>Synthetic</em>
                </div>
                <p>{entry.text}</p>
                <div className={styles.feedbackThemes}>
                  {entry.themes.map(theme => <span key={theme}>{theme}</span>)}
                  {entry.requiresRecovery && (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={event => openRecovery(entry, event.currentTarget)}
                    >
                      {labelFollowUp(entry.followUpStatus)}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {selectedIssue && (
        <div className={styles.recoveryLayer}>
          <button
            type="button"
            className={styles.recoveryBackdrop}
            aria-label="Close recovery record"
            onClick={closeRecovery}
          />
          <aside
            ref={recoveryDrawerRef}
            className={styles.recoveryDrawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recovery-drawer-title"
          >
            <header className={styles.drawerHeader}>
              <div>
                <span>Customer recovery</span>
                <h2 id="recovery-drawer-title">{selectedIssue.customerName}</h2>
              </div>
              <button
                ref={recoveryCloseRef}
                type="button"
                onClick={closeRecovery}
                aria-label="Close recovery record"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
              </button>
            </header>

            <div className={styles.drawerBody}>
              <section className={styles.selectedFeedback} aria-label="Selected synthetic feedback">
                <div>
                  <span data-rating={selectedIssue.rating <= 1 ? 'critical' : 'attention'}>{selectedIssue.rating}/5</span>
                  <div>
                    <strong>{selectedIssue.service}</strong>
                    <small>{selectedIssue.channel} · {dateFormatter.format(new Date(selectedIssue.receivedAt))}</small>
                  </div>
                </div>
                <p>{selectedIssue.text}</p>
                <small>Synthetic demo record · {selectedIssue.id}</small>
              </section>

              <div className={styles.drawerFields}>
                <label>
                  Issue status
                  <select value={issueStatus} onChange={event => setIssueStatus(event.target.value as FeedbackIssueStatus)}>
                    <option value="new">New issue</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </label>
                <label>
                  Follow-up
                  <select value={followUpStatus} onChange={event => setFollowUpStatus(event.target.value as FeedbackFollowUpStatus)}>
                    <option value="not_started">Not started</option>
                    <option value="contacted">Customer contacted</option>
                    <option value="awaiting_reply">Awaiting customer</option>
                    <option value="confirmed_resolved">Customer confirmed</option>
                  </select>
                </label>
                <label>
                  Resolution note
                  <textarea
                    value={resolutionNote}
                    onChange={event => setResolutionNote(event.target.value)}
                    maxLength={800}
                    placeholder="Record what was offered, what changed, and the next follow-up."
                  />
                  <small>Private demo note. Never published externally.</small>
                </label>
              </div>
            </div>

            <footer className={styles.drawerFooter}>
              <button type="button" className="btn btn-ghost" onClick={closeRecovery}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveRecovery}>Save recovery update</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  )
}
