'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type KnowledgeItem = {
  id: string
  type: 'faq' | 'fact' | 'video_context'
  title: string
  content: string
  scopeKey: string | null
  sourceTitle: string | null
  sourceDescription: string | null
  sourceFetchedAt: string | null
}

type EditValue = { title: string; content: string }

export default function YouTubeKnowledgeBase() {
  const [description, setDescription] = useState('')
  const [guidelines, setGuidelines] = useState('')
  const [savedBase, setSavedBase] = useState({ description: '', guidelines: '' })
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [edits, setEdits] = useState<Record<string, EditValue>>({})
  const [loading, setLoading] = useState(true)
  const [savingBase, setSavingBase] = useState(false)
  const [workingItem, setWorkingItem] = useState<string | null>(null)
  const [deletingItem, setDeletingItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [addType, setAddType] = useState<'faq' | 'fact' | 'video_context'>('faq')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newVideoId, setNewVideoId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/youtube/knowledge-base', { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not load the Knowledge Base.')
      const nextItems = Array.isArray(data.entries) ? data.entries as KnowledgeItem[] : []
      const nextDescription = typeof data.description === 'string' ? data.description : ''
      const nextGuidelines = typeof data.responseGuidelines === 'string' ? data.responseGuidelines : ''
      setDescription(nextDescription)
      setGuidelines(nextGuidelines)
      setSavedBase({ description: nextDescription, guidelines: nextGuidelines })
      setItems(nextItems)
      setEdits(Object.fromEntries(nextItems.map(item => [item.id, { title: item.title, content: item.content }])))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the Knowledge Base.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const grouped = useMemo(() => ({
    general: items.filter(item => item.type !== 'video_context'),
    videos: items.filter(item => item.type === 'video_context'),
  }), [items])

  async function saveBase() {
    if (savingBase) return
    setSavingBase(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/youtube/knowledge-base', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, responseGuidelines: guidelines }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save the Knowledge Base.')
      setSavedBase({ description, guidelines })
      setNotice('Channel context saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the Knowledge Base.')
    } finally {
      setSavingBase(false)
    }
  }

  async function createItem() {
    if (workingItem) return
    setWorkingItem('new')
    setError(null)
    setNotice(null)
    try {
      const response = await fetch('/api/youtube/knowledge-base/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: addType,
          title: newTitle,
          content: newContent,
          ...(addType === 'video_context' ? { videoId: newVideoId } : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not add the knowledge item.')
      setNewTitle('')
      setNewContent('')
      setNewVideoId('')
      setNotice('Knowledge item added.')
      await load()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not add the knowledge item.')
    } finally {
      setWorkingItem(null)
    }
  }

  async function saveItem(item: KnowledgeItem) {
    if (workingItem) return
    setWorkingItem(item.id)
    setError(null)
    setNotice(null)
    try {
      const value = edits[item.id]
      const response = await fetch(`/api/youtube/knowledge-base/items/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: value?.title ?? item.title, content: value?.content ?? item.content }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not save the knowledge item.')
      setNotice('Knowledge item saved.')
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the knowledge item.')
    } finally {
      setWorkingItem(null)
    }
  }

  async function deleteItem(item: KnowledgeItem) {
    if (workingItem) return
    setWorkingItem(item.id)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/youtube/knowledge-base/items/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not delete the knowledge item.')
      setDeletingItem(null)
      setNotice('Knowledge item deleted.')
      await load()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the knowledge item.')
    } finally {
      setWorkingItem(null)
    }
  }

  function renderItem(item: KnowledgeItem) {
    const value = edits[item.id] ?? { title: item.title, content: item.content }
    const dirty = value.title !== item.title || value.content !== item.content
    const isVideo = item.type === 'video_context'
    return (
      <div className="knowledge-item" key={item.id}>
        <div className="knowledge-item-head">
          <span>{isVideo ? 'Video context' : item.type === 'faq' ? 'FAQ' : 'Fact'}</span>
          {isVideo && item.scopeKey && <code>{item.scopeKey}</code>}
        </div>
        {!isVideo && (
          <label>
            <span>{item.type === 'faq' ? 'Question' : 'Subject'}</span>
            <input
              value={value.title}
              maxLength={item.type === 'fact' ? 200 : 500}
              onChange={event => setEdits(current => ({
                ...current,
                [item.id]: { ...value, title: event.target.value },
              }))}
              disabled={workingItem === item.id}
            />
          </label>
        )}
        {isVideo && item.sourceTitle && <strong>{item.sourceTitle}</strong>}
        {isVideo && item.sourceDescription && <p className="knowledge-video-source">{item.sourceDescription}</p>}
        <label>
          <span>{isVideo ? 'Custom video context' : item.type === 'faq' ? 'Answer' : 'Verified information'}</span>
          <textarea
            value={value.content}
            maxLength={isVideo ? 3000 : 2000}
            rows={isVideo ? 3 : 2}
            onChange={event => setEdits(current => ({
              ...current,
              [item.id]: { ...value, content: event.target.value },
            }))}
            disabled={workingItem === item.id}
          />
        </label>
        <div className="knowledge-item-actions">
          <button type="button" className="btn btn-quiet btn-sm" disabled={!dirty || Boolean(workingItem)} onClick={() => saveItem(item)}>
            {workingItem === item.id ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
          {deletingItem === item.id ? (
            <div className="knowledge-delete-confirm">
              <span>Delete this item?</span>
              <button type="button" className="btn btn-quiet btn-sm" disabled={Boolean(workingItem)} onClick={() => setDeletingItem(null)}>Cancel</button>
              <button type="button" className="btn btn-quiet btn-sm" disabled={Boolean(workingItem)} onClick={() => deleteItem(item)}>Delete</button>
            </div>
          ) : (
            <button type="button" className="text-link" disabled={Boolean(workingItem)} onClick={() => setDeletingItem(item.id)}>Delete</button>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div className="settings-loading-line skeleton" />

  return (
    <div className="youtube-knowledge" aria-live="polite">
      <div className="knowledge-intro">
        <strong>Reply Knowledge Base</strong>
        <p>Give Replova verified information it can use. Unsupported factual questions always stay in manual review.</p>
      </div>
      {error && <p className="simple-message is-error" role="alert">{error}</p>}
      {notice && <p className="simple-message is-success" role="status">{notice}</p>}

      <div className="knowledge-base-fields">
        <label>
          <span>Business or channel description</span>
          <textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={4000} rows={4} placeholder="What the channel covers, who it serves, and verified background information." />
          <small>{description.length}/4000</small>
        </label>
        <label>
          <span>Response guidelines</span>
          <textarea value={guidelines} onChange={event => setGuidelines(event.target.value)} maxLength={3000} rows={4} placeholder="Preferred voice, boundaries, and topics that should always be escalated." />
          <small>{guidelines.length}/3000</small>
        </label>
        <button type="button" className="btn btn-primary btn-sm" disabled={savingBase || (description === savedBase.description && guidelines === savedBase.guidelines)} onClick={saveBase}>
          {savingBase ? 'Saving…' : 'Save channel context'}
        </button>
      </div>

      <div className="knowledge-list-section">
        <div className="knowledge-list-heading">
          <div><strong>FAQs and facts</strong><span>Only add information you can verify.</span></div>
          <span>{grouped.general.length} items</span>
        </div>
        {grouped.general.length === 0 && <p className="knowledge-empty">No FAQs or custom facts yet.</p>}
        {grouped.general.map(renderItem)}
      </div>

      <div className="knowledge-list-section">
        <div className="knowledge-list-heading">
          <div><strong>Video-specific context</strong><span>Overrides general context when it directly applies to that video.</span></div>
          <span>{grouped.videos.length} videos</span>
        </div>
        {grouped.videos.length === 0 && <p className="knowledge-empty">Video titles and descriptions appear after comment sync, or add context by video ID below.</p>}
        {grouped.videos.map(renderItem)}
      </div>

      <div className="knowledge-add">
        <strong>Add information</strong>
        <div className="knowledge-add-grid">
          <label>
            <span>Type</span>
            <select value={addType} onChange={event => setAddType(event.target.value as typeof addType)}>
              <option value="faq">FAQ</option>
              <option value="fact">Custom fact</option>
              <option value="video_context">Video context</option>
            </select>
          </label>
          {addType === 'video_context' ? (
            <label><span>YouTube video ID</span><input value={newVideoId} onChange={event => setNewVideoId(event.target.value)} maxLength={200} placeholder="Video ID from the YouTube URL" /></label>
          ) : (
            <label><span>{addType === 'faq' ? 'Question' : 'Subject'}</span><input value={newTitle} onChange={event => setNewTitle(event.target.value)} maxLength={addType === 'fact' ? 200 : 500} /></label>
          )}
        </div>
        <label>
          <span>{addType === 'faq' ? 'Answer' : addType === 'fact' ? 'Verified information' : 'Custom video context'}</span>
          <textarea value={newContent} onChange={event => setNewContent(event.target.value)} maxLength={addType === 'video_context' ? 3000 : 2000} rows={3} />
        </label>
        <button type="button" className="btn btn-quiet btn-sm" disabled={workingItem === 'new'} onClick={createItem}>
          {workingItem === 'new' ? 'Adding…' : 'Add to Knowledge Base'}
        </button>
      </div>
    </div>
  )
}
