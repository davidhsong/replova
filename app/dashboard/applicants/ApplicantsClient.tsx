'use client'

import { useMemo, useState } from 'react'
import { IconExternal, IconSearch } from '@/components/icons'
import {
  CAREER_APPLICATION_STATUSES,
  type CareerApplication,
  type CareerApplicationStatus,
} from '@/lib/careerApplications'

const STATUS_LABELS: Record<CareerApplicationStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

function formatDate(value: string, includeTime = false) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

function ApplicantDetail({
  application,
  onUpdated,
}: {
  application: CareerApplication
  onUpdated: (application: CareerApplication) => void
}) {
  const [notes, setNotes] = useState(application.reviewer_notes)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  async function updateApplication(update: { status?: CareerApplicationStatus; reviewerNotes?: string }) {
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/careers/applications/${application.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const result = await response.json() as CareerApplication & { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to save this application.')
      onUpdated(result)
      setNotes(result.reviewer_notes)
      setMessage({ kind: 'success', text: 'Application updated.' })
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save this application.' })
    } finally {
      setSaving(false)
    }
  }

  const fullName = `${application.first_name} ${application.last_name}`

  return (
    <aside className="applicant-detail" aria-label={`${fullName} application`}>
      <div className="applicant-detail-head">
        <div>
          <span className="t-eyebrow">Candidate</span>
          <h2>{fullName}</h2>
          <p>{application.role_title}</p>
        </div>
        <span className="applicant-status" data-status={application.status}>{STATUS_LABELS[application.status]}</span>
      </div>

      <div className="applicant-contact-grid">
        <div><span>Email</span><a href={`mailto:${application.email}`}>{application.email}</a></div>
        <div><span>Applied</span><strong>{formatDate(application.created_at, true)}</strong></div>
        <div><span>School</span><strong>{application.school}</strong></div>
        <div><span>Program</span><strong>{application.program || 'Not provided'}</strong></div>
        <div><span>Graduation</span><strong>{application.graduation}</strong></div>
        <div><span>Availability</span><strong>{application.availability} · {application.timezone}</strong></div>
        <div><span>Sponsorship</span><strong>{application.requires_sponsorship ? 'Required' : 'Not required'}</strong></div>
        <div>
          <span>Links</span>
          <div className="applicant-file-links">
            {application.profile_url && <a href={application.profile_url} target="_blank" rel="noopener noreferrer">Profile <IconExternal s={12} /></a>}
            {application.resume_path && <a href={`/api/careers/applications/${application.id}/resume`}>Résumé <IconExternal s={12} /></a>}
            {!application.profile_url && !application.resume_path && <strong>None provided</strong>}
          </div>
        </div>
      </div>

      <div className="applicant-responses">
        <article><span>Why Replova</span><p>{application.motivation}</p></article>
        <article><span>Role response</span><p>{application.role_response}</p></article>
        <article><span>Learning goal</span><p>{application.learning_goal}</p></article>
      </div>

      <div className="applicant-review-panel">
        <div className="applicant-review-row">
          <label htmlFor={`status-${application.id}`}>Pipeline status</label>
          <select
            id={`status-${application.id}`}
            value={application.status}
            disabled={saving}
            onChange={event => updateApplication({ status: event.target.value as CareerApplicationStatus })}
          >
            {CAREER_APPLICATION_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
        </div>
        <label htmlFor={`notes-${application.id}`}>Private reviewer notes</label>
        <textarea
          id={`notes-${application.id}`}
          value={notes}
          onChange={event => setNotes(event.target.value)}
          maxLength={10000}
          placeholder="Interview notes, follow-up questions, or decision context…"
        />
        <div className="applicant-save-row">
          <div aria-live="polite">
            {message && <span className={message.kind === 'error' ? 'applicant-save-error' : 'applicant-save-success'}>{message.text}</span>}
          </div>
          <button className="btn btn-primary" disabled={saving || notes === application.reviewer_notes} onClick={() => updateApplication({ reviewerNotes: notes })}>
            {saving ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default function ApplicantsClient({ initialApplications }: { initialApplications: CareerApplication[] }) {
  const [applications, setApplications] = useState(initialApplications)
  const [selectedId, setSelectedId] = useState(initialApplications[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | CareerApplicationStatus>('all')
  const [role, setRole] = useState('all')
  const [sponsorship, setSponsorship] = useState<'all' | 'yes' | 'no'>('all')

  const roles = useMemo(() => Array.from(new Map(applications.map(application => [application.role_key, application.role_title])).entries()), [applications])
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return applications.filter(application => {
      if (status !== 'all' && application.status !== status) return false
      if (role !== 'all' && application.role_key !== role) return false
      if (sponsorship === 'yes' && !application.requires_sponsorship) return false
      if (sponsorship === 'no' && application.requires_sponsorship) return false
      if (!normalizedQuery) return true
      return [application.first_name, application.last_name, application.email, application.school, application.program, application.role_title]
        .some(value => value?.toLowerCase().includes(normalizedQuery))
    })
  }, [applications, query, role, sponsorship, status])

  const selected = applications.find(application => application.id === selectedId) ?? null
  const counts = CAREER_APPLICATION_STATUSES.reduce<Record<CareerApplicationStatus, number>>((result, value) => {
    result[value] = applications.filter(application => application.status === value).length
    return result
  }, { new: 0, reviewing: 0, shortlisted: 0, interview: 0, accepted: 0, rejected: 0 })

  function handleUpdated(updated: CareerApplication) {
    setApplications(current => current.map(application => application.id === updated.id ? updated : application))
  }

  return (
    <>
      <section className="applicant-stats" aria-label="Applicant pipeline summary">
        <div><span>All applicants</span><strong>{applications.length}</strong></div>
        <div><span>New</span><strong>{counts.new}</strong></div>
        <div><span>Shortlisted</span><strong>{counts.shortlisted}</strong></div>
        <div><span>Interview</span><strong>{counts.interview}</strong></div>
        <div><span>Accepted</span><strong>{counts.accepted}</strong></div>
      </section>

      <section className="applicant-toolbar" aria-label="Applicant filters">
        <label className="applicant-search">
          <IconSearch s={15} />
          <span className="sr-only">Search applicants</span>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, email, school…" />
        </label>
        <select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value as 'all' | CareerApplicationStatus)}>
          <option value="all">All statuses</option>
          {CAREER_APPLICATION_STATUSES.map(value => <option key={value} value={value}>{STATUS_LABELS[value]}</option>)}
        </select>
        <select aria-label="Filter by role" value={role} onChange={event => setRole(event.target.value)}>
          <option value="all">All roles</option>
          {roles.map(([key, title]) => <option key={key} value={key}>{title}</option>)}
        </select>
        <select aria-label="Filter by sponsorship" value={sponsorship} onChange={event => setSponsorship(event.target.value as 'all' | 'yes' | 'no')}>
          <option value="all">Any sponsorship</option>
          <option value="no">No sponsorship</option>
          <option value="yes">Requires sponsorship</option>
        </select>
        <span className="applicant-result-count">{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
      </section>

      <div className="applicant-workspace">
        <section className="applicant-list" aria-label="Applications">
          {filtered.length ? filtered.map(application => {
            const fullName = `${application.first_name} ${application.last_name}`
            return (
              <button
                key={application.id}
                className={`applicant-row${selectedId === application.id ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(application.id)}
                aria-pressed={selectedId === application.id}
              >
                <span className="applicant-avatar" aria-hidden="true">{application.first_name[0]}{application.last_name[0]}</span>
                <span className="applicant-row-main"><strong>{fullName}</strong><small>{application.role_title}</small></span>
                <span className="applicant-row-school">{application.school}</span>
                <span className="applicant-status" data-status={application.status}>{STATUS_LABELS[application.status]}</span>
                <time dateTime={application.created_at}>{formatDate(application.created_at)}</time>
              </button>
            )
          }) : (
            <div className="applicant-empty">
              <strong>No applications match these filters.</strong>
              <p>Clear one or more filters to see the rest of the pipeline.</p>
            </div>
          )}
        </section>
        {selected ? (
          <ApplicantDetail key={selected.id} application={selected} onUpdated={handleUpdated} />
        ) : (
          <aside className="applicant-detail applicant-detail-empty"><p>Select an applicant to review their submission.</p></aside>
        )}
      </div>
    </>
  )
}
