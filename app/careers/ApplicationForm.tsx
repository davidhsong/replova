'use client'

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from 'react'
import { PROGRAM_OPTIONS, SCHOOL_OPTIONS } from './educationOptions'

type FormState = { kind: 'idle' | 'submitting' | 'success' | 'error'; message?: string }

type ApplicationFormProps = {
  roleKey: string
  roleTitle: string
  roleQuestion: string
}

export default function ApplicationForm({ roleKey, roleTitle, roleQuestion }: ApplicationFormProps) {
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const [resumeError, setResumeError] = useState('')
  const [resumeName, setResumeName] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const resumeInput = useRef<HTMLInputElement>(null)

  function updateResume(files: FileList | null) {
    const file = files?.[0]
    const message = file && (!/\.(pdf|docx?)$/i.test(file.name) || file.size > 4 * 1024 * 1024)
      ? 'Choose a PDF, DOC or DOCX file up to 4 MB.' : ''
    resumeInput.current?.setCustomValidity(message)
    setResumeError(message)
    if (!file) { setResumeName(''); return }

    if (resumeInput.current && resumeInput.current.files !== files) {
      const transfer = new DataTransfer()
      transfer.items.add(file)
      resumeInput.current.files = transfer.files
    }
    setResumeName(file.name)
  }

  function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    updateResume(event.target.files)
  }

  function handleResumeDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    updateResume(event.dataTransfer.files)
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setState({ kind: 'submitting' })
    try {
      const response = await fetch('/api/careers/apply', { method: 'POST', body: new FormData(form) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || 'Unable to submit your application.')
      form.reset()
      setResumeName('')
      setState({ kind: 'success', message: 'Application sent. Thanks for taking the time to introduce yourself. We will reply by email if there is a fit.' })
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : 'Unable to submit your application.' })
    }
  }

  return (
    <form className="application-form" onSubmit={submitApplication} encType="multipart/form-data">
      <div className="form-grid">
        <input type="hidden" name="role" value={roleKey} />
        <div className="form-honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label><input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <div className="application-role form-field-full">
          <span>Applying for</span>
          <strong>{roleTitle}</strong>
        </div>
        <div className="form-section-heading form-field-full">
          <span>01</span>
          <div><strong>Contact details</strong><small>How we can reach you.</small></div>
        </div>
        <div className="form-field"><label htmlFor="firstName">First name *</label><input id="firstName" name="firstName" required maxLength={80} autoComplete="given-name" /></div>
        <div className="form-field"><label htmlFor="lastName">Last name *</label><input id="lastName" name="lastName" required maxLength={80} autoComplete="family-name" /></div>
        <div className="form-field"><label htmlFor="email">Email *</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" /></div>
        <div className="form-field"><label htmlFor="profileUrl">LinkedIn, portfolio, or GitHub URL</label><input id="profileUrl" name="profileUrl" type="url" placeholder="https://" maxLength={500} /></div>
        <div className="form-section-heading form-field-full">
          <span>02</span>
          <div><strong>Education & availability</strong><small>Start typing to see suggestions, or enter your own answer.</small></div>
        </div>
        <div className="form-field">
          <label htmlFor="school">School or educational program *</label>
          <input id="school" name="school" list="school-options" required maxLength={160} autoComplete="organization" placeholder="Start typing your school" />
          <datalist id="school-options">
            {SCHOOL_OPTIONS.map(school => <option key={school} value={school} />)}
          </datalist>
        </div>
        <div className="form-field">
          <label htmlFor="program">Program / field of study</label>
          <input id="program" name="program" list="program-options" maxLength={160} placeholder="Start typing your field" />
          <datalist id="program-options">
            {PROGRAM_OPTIONS.map(program => <option key={program} value={program} />)}
          </datalist>
        </div>
        <div className="form-field"><label htmlFor="graduation">Expected graduation *</label><input id="graduation" name="graduation" placeholder="e.g. May 2028" required maxLength={40} /></div>
        <div className="form-field"><label htmlFor="timezone">Time zone *</label><input id="timezone" name="timezone" placeholder="e.g. Pacific Time" required maxLength={80} /></div>
        <div className="form-field"><label htmlFor="availability">Weekly availability *</label><input id="availability" name="availability" placeholder="e.g. 10 hours" required maxLength={80} /></div>
        <div className="form-section-heading form-field-full">
          <span>03</span>
          <div><strong>About you</strong><small>A few thoughtful answers are more useful than polished language.</small></div>
        </div>
        <fieldset className="form-choice-group form-field-full">
          <legend>Do you require visa or work sponsorship? *</legend>
          <label><input type="radio" name="sponsorship" value="yes" required /> Yes</label>
          <label><input type="radio" name="sponsorship" value="no" required /> No</label>
        </fieldset>
        <div className="form-field form-field-full"><label htmlFor="motivation">Why do you want to work with Replova? *</label><textarea id="motivation" name="motivation" required minLength={40} maxLength={2500} /></div>
        <div className="form-field form-field-full"><label htmlFor="roleResponse">{roleQuestion} *</label><textarea id="roleResponse" name="roleResponse" required minLength={30} maxLength={2000} /></div>
        <div className="form-field form-field-full"><label htmlFor="learningGoal">What do you hope to learn during this internship? *</label><textarea id="learningGoal" name="learningGoal" required minLength={20} maxLength={1500} /></div>
        <div className="form-section-heading form-field-full">
          <span>04</span>
          <div><strong>Resume & consent</strong><small>Resume upload is optional.</small></div>
        </div>
        <div className="form-field form-field-full">
          <span className="form-label">Resume (optional)</span>
          <label
            htmlFor="resume"
            className={`resume-dropzone${isDragging ? ' is-dragging' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleResumeDrop}
          >
            <input aria-label="Resume (optional)" aria-invalid={Boolean(resumeError)} aria-describedby="resume-help" ref={resumeInput} id="resume" name="resume" type="file" className="resume-input" onChange={handleResumeChange} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
            <strong>{resumeName || 'Drop your resume here, or click to browse'}</strong>
            <span id="resume-help">PDF, DOC, or DOCX - maximum 4 MB</span>
          </label>
          {resumeError && <p role="alert">{resumeError}</p>}
        </div>
        <label className="form-consent"><input type="checkbox" name="eligibilityConfirmed" required /><span>I confirm I am at least 18, currently enrolled in an educational program, and understand this is a limited, unpaid learning internship with no promise of a paid role. *</span></label>
        <label className="form-consent"><input type="checkbox" name="privacyAccepted" required /><span>I agree that Replova may use my application information to evaluate and contact me about this role, as described in the <a href="/privacy" className="text-link">Privacy Policy</a>. *</span></label>
        {state.kind === 'success' && <div className="form-status form-status-success" role="status">{state.message}</div>}
        {state.kind === 'error' && <div className="form-status form-status-error" role="alert">{state.message}</div>}
        <button type="submit" className="btn btn-primary btn-lg" disabled={state.kind === 'submitting'}>{state.kind === 'submitting' ? 'Sending…' : 'Send application'}</button>
      </div>
    </form>
  )
}
