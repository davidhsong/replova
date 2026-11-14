'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function WorkspaceSetupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/onboarding/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? 'Unable to create your workspace.')
        setLoading(false)
        return
      }
      router.replace('/dashboard?welcome=true')
      router.refresh()
    } catch {
      setError('Unable to create your workspace. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="workspace-setup-form">
      <div className="account-onboarding-field">
        <label htmlFor="workspace-name">Business name</label>
        <input
          id="workspace-name"
          name="name"
          required
          minLength={2}
          maxLength={200}
          autoComplete="organization"
          autoFocus
          value={name}
          onChange={event => { setName(event.target.value); setError(null) }}
          placeholder="Your business name"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'workspace-error' : 'workspace-name-help'}
        />
        <small id="workspace-name-help">Use the name you want displayed inside Replova. You can connect listings later.</small>
        {error && <p id="workspace-error" className="account-onboarding-error" role="alert">{error}</p>}
      </div>
      <button className="btn btn-primary account-onboarding-submit" type="submit" disabled={loading || name.trim().length < 2}>
        {loading ? 'Creating workspace...' : 'Create workspace'}
      </button>
    </form>
  )
}
