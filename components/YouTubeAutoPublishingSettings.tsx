'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconAlert, IconCheck, IconLock, IconX } from '@/components/icons'

type PublishingMode = 'manual_approval' | 'auto_publish'
type CategoryAction = 'auto_publish' | 'manual_review' | 'skip'
type Category = 'praise' | 'thanks' | 'neutral_feedback' | 'question' | 'complaint' | 'negative_feedback' | 'other' | 'spam'
type VideoFilterMode = 'all' | 'include' | 'exclude'

type CategoryRules = Record<Category, CategoryAction>

type PolicyResponse = {
  publishingMode: PublishingMode
  emergencyPaused: boolean
  categoryRules: CategoryRules
  maxAutoPublishesPerDay: number
  minimumConfidence: number
  replyDelayMinutes: number
  commenterCooldownHours: number
  eligibleVideoFilter: {
    mode: VideoFilterMode
    videoIds: string[]
  }
  consent: {
    current: boolean
    grantedAt: string | null
    revokedAt: string | null
    version: string | null
  }
  runtimeEnabled: boolean
  updatedAt: string
}

type ConsentResponse = {
  version: string
  disclosure: {
    publishesPublicReplies: boolean
    governedBySavedRules: boolean
    mayUseEditedOrGeneratedDrafts: boolean
    disableInstructions: string
    runtimeEnabled: boolean
  }
}

type PolicyDraft = {
  categoryRules: CategoryRules
  maxAutoPublishesPerDay: number
  minimumConfidencePercent: number
  replyDelayMinutes: number
  commenterCooldownHours: number
  eligibleVideoFilterMode: VideoFilterMode
  eligibleVideoIds: string
}

const CATEGORY_LABELS: Record<Category, { label: string; description: string }> = {
  praise: { label: 'Praise', description: 'Positive comments and compliments' },
  thanks: { label: 'Thanks', description: 'Short expressions of appreciation' },
  neutral_feedback: { label: 'Neutral feedback', description: 'Balanced or informational feedback' },
  question: { label: 'Questions', description: 'Comments asking for an answer' },
  complaint: { label: 'Complaints', description: 'Service or experience concerns' },
  negative_feedback: { label: 'Negative feedback', description: 'Critical comments without a direct complaint' },
  other: { label: 'Other', description: 'Comments that do not fit another category' },
  spam: { label: 'Spam', description: 'Promotional or irrelevant content' },
}

const CATEGORY_ACTIONS: Array<{ value: CategoryAction; label: string }> = [
  { value: 'auto_publish', label: 'Auto-Publish' },
  { value: 'manual_review', label: 'Manual Review' },
  { value: 'skip', label: 'Skip' },
]

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[]

function draftFromPolicy(policy: PolicyResponse): PolicyDraft {
  return {
    categoryRules: { ...policy.categoryRules },
    maxAutoPublishesPerDay: policy.maxAutoPublishesPerDay,
    minimumConfidencePercent: Math.round(policy.minimumConfidence * 100),
    replyDelayMinutes: policy.replyDelayMinutes,
    commenterCooldownHours: policy.commenterCooldownHours,
    eligibleVideoFilterMode: policy.eligibleVideoFilter.mode,
    eligibleVideoIds: policy.eligibleVideoFilter.videoIds.join('\n'),
  }
}

function normalizedDraft(draft: PolicyDraft) {
  return JSON.stringify({
    ...draft,
    eligibleVideoIds: draft.eligibleVideoIds.split(/[\s,]+/).map(value => value.trim()).filter(Boolean).sort(),
  })
}

function parseVideoIds(value: string): { ids: string[]; error: string | null } {
  const ids = [...new Set(value.split(/[\s,]+/).map(item => item.trim()).filter(Boolean))]
  if (ids.length > 100) return { ids, error: 'Use no more than 100 video IDs.' }
  if (ids.some(id => !/^[A-Za-z0-9_-]{1,200}$/.test(id))) {
    return { ids, error: 'Video IDs may only contain letters, numbers, underscores, and hyphens.' }
  }
  return { ids, error: null }
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function fetchAutoPublishingSettings() {
  const [policyResponse, consentResponse] = await Promise.all([
    fetch('/api/youtube/automation/policy', { cache: 'no-store' }),
    fetch('/api/youtube/automation/consent', { cache: 'no-store' }),
  ])
  const policyData = await policyResponse.json().catch(() => ({}))
  const consentData = await consentResponse.json().catch(() => ({}))
  if (!policyResponse.ok) throw new Error(policyData.error ?? 'Could not load auto-publishing settings.')
  if (!consentResponse.ok) throw new Error(consentData.error ?? 'Could not load the consent disclosure.')
  return { policy: policyData as PolicyResponse, consent: consentData as ConsentResponse }
}

export default function YouTubeAutoPublishingSettings() {
  const [policy, setPolicy] = useState<PolicyResponse | null>(null)
  const [draft, setDraft] = useState<PolicyDraft | null>(null)
  const [consentDisclosure, setConsentDisclosure] = useState<ConsentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pauseSaving, setPauseSaving] = useState(false)
  const [modeSaving, setModeSaving] = useState(false)
  const [consentOpen, setConsentOpen] = useState(false)
  const [acknowledgements, setAcknowledgements] = useState({
    publishesPublicReplies: false,
    usesSavedRules: false,
    canPauseOrRevoke: false,
  })
  const [consentError, setConsentError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const cancelConsentRef = useRef<HTMLButtonElement>(null)
  const consentDialogRef = useRef<HTMLElement>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchAutoPublishingSettings()
      setPolicy(data.policy)
      setDraft(draftFromPolicy(data.policy))
      setConsentDisclosure(data.consent)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load auto-publishing settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchAutoPublishingSettings()
      .then(data => {
        if (cancelled) return
        setPolicy(data.policy)
        setDraft(draftFromPolicy(data.policy))
        setConsentDisclosure(data.consent)
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load auto-publishing settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!consentOpen) return
    cancelConsentRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !modeSaving) {
        setConsentOpen(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(consentDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled])'
      ) ?? [])]
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
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [consentOpen, modeSaving])

  const isDirty = useMemo(() => {
    if (!policy || !draft) return false
    return normalizedDraft(draft) !== normalizedDraft(draftFromPolicy(policy))
  }, [draft, policy])

  const status = useMemo(() => {
    if (!policy) return null
    if (policy.emergencyPaused) {
      return { tone: 'paused', label: 'Paused', detail: 'Emergency Pause is on. No automatic publishing can run.' }
    }
    if (policy.publishingMode === 'auto_publish' && !policy.consent.current) {
      return { tone: 'waiting', label: 'Awaiting consent', detail: 'Review the current rules and authorize public replies.' }
    }
    if (policy.publishingMode === 'auto_publish' && policy.consent.current && policy.runtimeEnabled) {
      return { tone: 'running', label: 'Running', detail: 'Eligible replies can be published automatically.' }
    }
    if (policy.publishingMode === 'auto_publish' && policy.consent.current) {
      return { tone: 'inactive', label: 'Configured, not running', detail: 'Your rules and consent are saved, but the publishing worker is disabled.' }
    }
    return { tone: 'manual', label: 'Manual approval', detail: 'Replies stay in the queue until you publish them.' }
  }, [policy])

  function updateDraft<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    setDraft(current => current ? { ...current, [key]: value } : current)
    setSaveMessage(null)
    setFieldErrors(current => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function validatePolicy(current: PolicyDraft) {
    const errors: Record<string, string> = {}
    if (!Number.isInteger(current.maxAutoPublishesPerDay) || current.maxAutoPublishesPerDay < 1 || current.maxAutoPublishesPerDay > 500) {
      errors.maxAutoPublishesPerDay = 'Enter a whole number from 1 to 500.'
    }
    if (!Number.isInteger(current.minimumConfidencePercent) || current.minimumConfidencePercent < 0 || current.minimumConfidencePercent > 100) {
      errors.minimumConfidencePercent = 'Enter a whole percentage from 0 to 100.'
    }
    if (!Number.isInteger(current.replyDelayMinutes) || current.replyDelayMinutes < 0 || current.replyDelayMinutes > 10080) {
      errors.replyDelayMinutes = 'Enter a delay from 0 to 10,080 minutes.'
    }
    if (!Number.isInteger(current.commenterCooldownHours) || current.commenterCooldownHours < 0 || current.commenterCooldownHours > 8760) {
      errors.commenterCooldownHours = 'Enter a cooldown from 0 to 8,760 hours.'
    }
    const parsedVideos = parseVideoIds(current.eligibleVideoIds)
    if (parsedVideos.error) errors.eligibleVideoIds = parsedVideos.error
    if (current.eligibleVideoFilterMode !== 'all' && parsedVideos.ids.length === 0) {
      errors.eligibleVideoIds = 'Add at least one video ID for this filter.'
    }
    setFieldErrors(errors)
    return { valid: Object.keys(errors).length === 0, videoIds: parsedVideos.ids }
  }

  async function savePolicy() {
    if (!draft || !policy) return
    const validation = validatePolicy(draft)
    if (!validation.valid) {
      setSaveMessage({ ok: false, text: 'Check the highlighted settings and try again.' })
      return
    }

    setSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/youtube/automation/policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: policy.updatedAt,
          categoryRules: draft.categoryRules,
          maxAutoPublishesPerDay: draft.maxAutoPublishesPerDay,
          minimumConfidence: draft.minimumConfidencePercent / 100,
          replyDelayMinutes: draft.replyDelayMinutes,
          commenterCooldownHours: draft.commenterCooldownHours,
          eligibleVideoFilterMode: draft.eligibleVideoFilterMode,
          eligibleVideoIds: draft.eligibleVideoFilterMode === 'all' ? [] : validation.videoIds,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save auto-publishing settings.')
      const nextPolicy = data as PolicyResponse
      const consentWasInvalidated = policy.consent.current && !nextPolicy.consent.current
      setPolicy(nextPolicy)
      setDraft(draftFromPolicy(nextPolicy))
      setSaveMessage({
        ok: true,
        text: consentWasInvalidated
          ? 'Settings saved. Because the publishing scope changed, review and grant consent again before auto-publishing can be configured.'
          : 'Auto-publishing settings saved.',
      })
    } catch (error) {
      setSaveMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not save auto-publishing settings.' })
    } finally {
      setSaving(false)
    }
  }

  async function setEmergencyPause(paused: boolean) {
    if (!policy) return
    setPauseSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/youtube/automation/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not update Emergency Pause.')
      setPolicy(current => current ? {
        ...current,
        emergencyPaused: data.emergencyPaused === true,
        runtimeEnabled: data.runtimeEnabled === true,
      } : current)
      setSaveMessage({
        ok: true,
        text: paused
          ? 'Emergency Pause is on. Automatic publishing remains stopped.'
          : 'Emergency Pause cleared. The publishing worker is still disabled, so nothing will publish automatically.',
      })
    } catch (error) {
      setSaveMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not update Emergency Pause.' })
    } finally {
      setPauseSaving(false)
    }
  }

  function openConsent() {
    if (isDirty) {
      setSaveMessage({ ok: false, text: 'Save your policy changes before reviewing consent.' })
      return
    }
    setAcknowledgements({ publishesPublicReplies: false, usesSavedRules: false, canPauseOrRevoke: false })
    setConsentError(null)
    setConsentOpen(true)
  }

  async function grantConsent() {
    if (!consentDisclosure) return
    if (!Object.values(acknowledgements).every(Boolean)) {
      setConsentError('Acknowledge all three items before authorizing auto-publishing.')
      return
    }
    setModeSaving(true)
    setConsentError(null)
    try {
      const response = await fetch('/api/youtube/automation/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant',
          consentVersion: consentDisclosure.version,
          acknowledgements,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not record auto-publishing consent.')
      setPolicy(current => current ? {
        ...current,
        publishingMode: data.publishingMode,
        runtimeEnabled: data.runtimeEnabled === true,
        consent: {
          current: data.consentCurrent === true,
          grantedAt: data.grantedAt ?? null,
          revokedAt: data.revokedAt ?? null,
          version: consentDisclosure.version,
        },
      } : current)
      setConsentOpen(false)
      setSaveMessage({
        ok: true,
        text: 'Consent recorded. Your auto-publish rules are configured, but no replies will publish automatically while the worker is disabled.',
      })
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : 'Could not record auto-publishing consent.')
    } finally {
      setModeSaving(false)
    }
  }

  async function switchToManualApproval() {
    if (!policy || policy.publishingMode === 'manual_approval') return
    setModeSaving(true)
    setSaveMessage(null)
    try {
      const response = await fetch('/api/youtube/automation/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not switch to Manual Approval.')
      setPolicy(current => current ? {
        ...current,
        publishingMode: data.publishingMode,
        runtimeEnabled: data.runtimeEnabled === true,
        consent: {
          ...current.consent,
          current: false,
          revokedAt: data.revokedAt ?? new Date().toISOString(),
        },
      } : current)
      setSaveMessage({ ok: true, text: 'Manual Approval is on. Replies will remain in the queue until you publish them.' })
    } catch (error) {
      setSaveMessage({ ok: false, text: error instanceof Error ? error.message : 'Could not switch to Manual Approval.' })
    } finally {
      setModeSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="youtube-auto-publish" aria-busy="true" aria-label="Loading auto-publishing settings">
        <div className="youtube-auto-loading skeleton" />
        <div className="youtube-auto-loading is-short skeleton" />
      </div>
    )
  }

  if (loadError || !policy || !draft || !consentDisclosure) {
    return (
      <div className="youtube-auto-publish">
        <div className="youtube-auto-load-error" role="alert">
          <div><IconAlert s={17} /><span>{loadError ?? 'Could not load auto-publishing settings.'}</span></div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => void loadSettings()}>Try again</button>
        </div>
      </div>
    )
  }

  const allAcknowledged = Object.values(acknowledgements).every(Boolean)

  return (
    <div className="youtube-auto-publish">
      <div className="youtube-auto-heading">
        <div>
          <span className="youtube-auto-kicker"><IconLock s={12} /> Publishing controls</span>
          <h3>Auto-Publishing</h3>
          <p>Choose which replies may qualify for automatic publishing and keep firm safety limits around them.</p>
        </div>
        {status && (
          <div className="youtube-auto-status" data-tone={status.tone} role="status">
            <i aria-hidden="true" />
            <div><strong>{status.label}</strong><span>{status.detail}</span></div>
          </div>
        )}
      </div>

      <div className="youtube-runtime-notice" role="note">
        <IconAlert s={18} />
        <div>
          <strong>Automatic publishing is not operational yet</strong>
          <p>The publishing worker is disabled. You can configure rules and record consent now, but every reply still requires manual publishing from the Reply Queue.</p>
        </div>
      </div>

      <div className="youtube-auto-control-bar">
        <div>
          <span className="youtube-auto-control-label">Emergency Pause</span>
          <p>Immediately blocks automatic publishing eligibility.</p>
        </div>
        <button
          type="button"
          className={`youtube-pause-button ${policy.emergencyPaused ? 'is-paused' : ''}`}
          aria-pressed={policy.emergencyPaused}
          onClick={() => void setEmergencyPause(!policy.emergencyPaused)}
          disabled={pauseSaving}
        >
          <IconAlert s={14} />
          {pauseSaving ? 'Updating…' : policy.emergencyPaused ? 'Clear Emergency Pause' : 'Pause automation'}
        </button>
      </div>

      <fieldset className="youtube-mode-fieldset" disabled={modeSaving}>
        <legend>Publishing mode</legend>
        <div className="youtube-mode-grid">
          <button
            type="button"
            className="youtube-mode-option"
            data-selected={policy.publishingMode === 'manual_approval'}
            aria-pressed={policy.publishingMode === 'manual_approval'}
            onClick={() => void switchToManualApproval()}
          >
            <span className="youtube-mode-check">{policy.publishingMode === 'manual_approval' && <IconCheck s={13} />}</span>
            <span><strong>Manual Approval</strong><small>Drafts wait in the Reply Queue for you to review and publish.</small></span>
          </button>
          <button
            type="button"
            className="youtube-mode-option"
            data-selected={policy.publishingMode === 'auto_publish'}
            aria-pressed={policy.publishingMode === 'auto_publish'}
            onClick={openConsent}
          >
            <span className="youtube-mode-check">{policy.publishingMode === 'auto_publish' && <IconCheck s={13} />}</span>
            <span><strong>Auto-Publish</strong><small>Configure eligibility now. The worker remains disabled until a later release.</small></span>
          </button>
        </div>
      </fieldset>

      <div className="youtube-consent-summary">
        <div>
          <span>Consent</span>
          <strong>{policy.consent.current ? 'Current for these rules' : 'Not current'}</strong>
          {policy.consent.current && policy.consent.grantedAt && <small>Granted {formatDate(policy.consent.grantedAt)}</small>}
          {!policy.consent.current && policy.consent.revokedAt && <small>Revoked or invalidated {formatDate(policy.consent.revokedAt)}</small>}
        </div>
        <p>Consent is tied to the exact publishing rules below. Material policy changes invalidate it, and you must review and authorize the new scope again.</p>
        <button type="button" className="btn btn-quiet btn-sm" onClick={openConsent} disabled={modeSaving}>
          {policy.consent.current ? 'Review consent' : 'Review and authorize'}
        </button>
      </div>

      <div className="youtube-policy-section">
        <div className="youtube-policy-heading">
          <div><span>Category rules</span><h4>Decide what happens after classification</h4></div>
          <p>Sensitive, uncertain, or unverified comments may still require manual review under the platform safety policy.</p>
        </div>
        <div className="youtube-category-rules">
          {CATEGORIES.map(category => (
            <div className="youtube-category-row" key={category}>
              <div><strong>{CATEGORY_LABELS[category].label}</strong><span>{CATEGORY_LABELS[category].description}</span></div>
              <div className="youtube-category-actions" role="group" aria-label={`${CATEGORY_LABELS[category].label} action`}>
                {CATEGORY_ACTIONS.map(action => (
                  <button
                    key={action.value}
                    type="button"
                    data-selected={draft.categoryRules[category] === action.value}
                    aria-pressed={draft.categoryRules[category] === action.value}
                    disabled={category === 'spam' && action.value !== 'skip'}
                    onClick={() => updateDraft('categoryRules', { ...draft.categoryRules, [category]: action.value })}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="youtube-safety-grid">
        <label className="youtube-policy-field" htmlFor="youtube-daily-limit">
          <span>Daily reply limit</span>
          <input
            id="youtube-daily-limit"
            type="number"
            min={1}
            max={500}
            step={1}
            inputMode="numeric"
            value={draft.maxAutoPublishesPerDay}
            aria-invalid={Boolean(fieldErrors.maxAutoPublishesPerDay)}
            aria-describedby={fieldErrors.maxAutoPublishesPerDay ? 'youtube-daily-limit-error' : 'youtube-daily-limit-help'}
            onChange={event => updateDraft('maxAutoPublishesPerDay', Number(event.target.value))}
          />
          <small id="youtube-daily-limit-help">Maximum eligible public replies per day.</small>
          {fieldErrors.maxAutoPublishesPerDay && <em id="youtube-daily-limit-error">{fieldErrors.maxAutoPublishesPerDay}</em>}
        </label>
        <label className="youtube-policy-field" htmlFor="youtube-min-confidence">
          <span>Minimum confidence</span>
          <div className="youtube-input-suffix"><input
            id="youtube-min-confidence"
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={draft.minimumConfidencePercent}
            aria-invalid={Boolean(fieldErrors.minimumConfidencePercent)}
            aria-describedby={fieldErrors.minimumConfidencePercent ? 'youtube-confidence-error' : 'youtube-confidence-help'}
            onChange={event => updateDraft('minimumConfidencePercent', Number(event.target.value))}
          /><span>%</span></div>
          <small id="youtube-confidence-help">Lower-confidence classifications go to Manual Review.</small>
          {fieldErrors.minimumConfidencePercent && <em id="youtube-confidence-error">{fieldErrors.minimumConfidencePercent}</em>}
        </label>
      </div>

      <details className="youtube-advanced-controls">
        <summary>
          <span><strong>Advanced safeguards</strong><small>Reply timing, commenter cooldown, and video eligibility</small></span>
          <span className="youtube-advanced-chevron" aria-hidden="true" />
        </summary>
        <div className="youtube-advanced-body">
          <div className="youtube-safety-grid">
            <label className="youtube-policy-field" htmlFor="youtube-reply-delay">
              <span>Reply delay</span>
              <div className="youtube-input-suffix"><input
                id="youtube-reply-delay"
                type="number"
                min={0}
                max={10080}
                step={1}
                inputMode="numeric"
                value={draft.replyDelayMinutes}
                aria-invalid={Boolean(fieldErrors.replyDelayMinutes)}
                onChange={event => updateDraft('replyDelayMinutes', Number(event.target.value))}
              /><span>min</span></div>
              <small>Wait after a comment is posted before it can qualify.</small>
              {fieldErrors.replyDelayMinutes && <em>{fieldErrors.replyDelayMinutes}</em>}
            </label>
            <label className="youtube-policy-field" htmlFor="youtube-commenter-cooldown">
              <span>Commenter cooldown</span>
              <div className="youtube-input-suffix"><input
                id="youtube-commenter-cooldown"
                type="number"
                min={0}
                max={8760}
                step={1}
                inputMode="numeric"
                value={draft.commenterCooldownHours}
                aria-invalid={Boolean(fieldErrors.commenterCooldownHours)}
                onChange={event => updateDraft('commenterCooldownHours', Number(event.target.value))}
              /><span>hr</span></div>
              <small>Wait before another reply to the same commenter can qualify.</small>
              {fieldErrors.commenterCooldownHours && <em>{fieldErrors.commenterCooldownHours}</em>}
            </label>
          </div>
          <fieldset className="youtube-video-filter">
            <legend>Video filter</legend>
            <p>Choose whether these rules apply to every video or a specific set.</p>
            <div className="youtube-video-filter-options">
              {([
                ['all', 'All videos'],
                ['include', 'Only listed videos'],
                ['exclude', 'All except listed videos'],
              ] as Array<[VideoFilterMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  data-selected={draft.eligibleVideoFilterMode === value}
                  aria-pressed={draft.eligibleVideoFilterMode === value}
                  onClick={() => {
                    updateDraft('eligibleVideoFilterMode', value)
                    if (value === 'all') updateDraft('eligibleVideoIds', '')
                  }}
                >{label}</button>
              ))}
            </div>
            {draft.eligibleVideoFilterMode !== 'all' && (
              <label className="youtube-policy-field youtube-video-ids" htmlFor="youtube-video-ids">
                <span>Video IDs</span>
                <textarea
                  id="youtube-video-ids"
                  rows={4}
                  placeholder={'dQw4w9WgXcQ\nAnotherVideoId'}
                  value={draft.eligibleVideoIds}
                  aria-invalid={Boolean(fieldErrors.eligibleVideoIds)}
                  onChange={event => updateDraft('eligibleVideoIds', event.target.value)}
                />
                <small>One YouTube video ID per line, or separate IDs with commas.</small>
                {fieldErrors.eligibleVideoIds && <em>{fieldErrors.eligibleVideoIds}</em>}
              </label>
            )}
          </fieldset>
        </div>
      </details>

      <div className="youtube-auto-savebar">
        <div aria-live="polite">
          {saveMessage && <p className={saveMessage.ok ? 'is-success' : 'is-error'}>{saveMessage.text}</p>}
          {!saveMessage && isDirty && <p>You have unsaved publishing policy changes.</p>}
          {!saveMessage && !isDirty && <p>Rules saved. Automatic publishing remains disabled.</p>}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void savePolicy()} disabled={!isDirty || saving}>
          {saving ? 'Saving…' : 'Save publishing rules'}
        </button>
      </div>

      {consentOpen && (
        <div className="youtube-consent-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget && !modeSaving) setConsentOpen(false)
        }}>
          <section ref={consentDialogRef} className="youtube-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="youtube-consent-title" aria-describedby="youtube-consent-description">
            <div className="youtube-consent-dialog-head">
              <div><span>Explicit authorization</span><h3 id="youtube-consent-title">Allow public YouTube replies</h3></div>
              <button type="button" className="youtube-dialog-close" aria-label="Close consent dialog" onClick={() => setConsentOpen(false)} disabled={modeSaving}><IconX s={16} /></button>
            </div>
            <p id="youtube-consent-description">Replova is asking for permission to publish replies publicly on your connected YouTube channel when your saved rules consider a comment eligible.</p>
            <div className="youtube-consent-runtime">
              <IconAlert s={16} />
              <p><strong>The worker is currently disabled.</strong> Granting consent records your authorization but does not start automatic publishing.</p>
            </div>
            <div className="youtube-consent-checks">
              <label>
                <input type="checkbox" checked={acknowledgements.publishesPublicReplies} onChange={event => setAcknowledgements(current => ({ ...current, publishesPublicReplies: event.target.checked }))} />
                <span><strong>I authorize public replies</strong><small>Eligible replies may appear publicly under comments on my connected YouTube channel.</small></span>
              </label>
              <label>
                <input type="checkbox" checked={acknowledgements.usesSavedRules} onChange={event => setAcknowledgements(current => ({ ...current, usesSavedRules: event.target.checked }))} />
                <span><strong>I understand which rules apply</strong><small>Replova will use the category actions, confidence threshold, limits, timing, and video filters I saved.</small></span>
              </label>
              <label>
                <input type="checkbox" checked={acknowledgements.canPauseOrRevoke} onChange={event => setAcknowledgements(current => ({ ...current, canPauseOrRevoke: event.target.checked }))} />
                <span><strong>I know how to stop it</strong><small>{consentDisclosure.disclosure.disableInstructions}</small></span>
              </label>
            </div>
            <p className="youtube-consent-version">Consent version: {consentDisclosure.version}. Changing the authorized policy scope requires renewed consent.</p>
            {consentError && <p className="youtube-consent-error" role="alert">{consentError}</p>}
            <div className="youtube-consent-actions">
              <button ref={cancelConsentRef} type="button" className="btn btn-quiet" onClick={() => setConsentOpen(false)} disabled={modeSaving}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => void grantConsent()} disabled={!allAcknowledged || modeSaving}>
                {modeSaving ? 'Recording consent…' : 'Authorize Auto-Publish'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
