'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { IconExternal, IconRefresh } from '@/components/icons'
import type { YouTubeQueueFilter } from '@/lib/youtubeQueuePolicy'

type QueueItem = {
  id: string
  youtubeCommentId: string
  videoId: string
  author: string
  comment: string
  commentPublishedAt: string
  category: string | null
  confidence: number | null
  processingState: string
  approvalStatus: string
  draft: string | null
  generatedDraft: string | null
  hasManualEdit: boolean
  publishedReplyId: string | null
  publishedReplyUrl: string | null
  publishedAt: string | null
  publishResultUncertain: boolean
  replyVerificationStatus: string
  replyVerificationError: string | null
  requiresManualReview: boolean
  manualReviewReason: string | null
  knowledgeGrounded: boolean
  knowledgeEntryCount: number
  lastError: string | null
  updatedAt: string
}

type VideoContext = {
  videoId: string
  title: string
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  commentCount: number | null
  privacyStatus: string | null
}

const FILTERS: Array<{ value: YouTubeQueueFilter; label: string }> = [
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
]

function statusLabel(item: QueueItem) {
  if (item.processingState === 'published') return 'Published'
  if (item.processingState === 'publishing') return 'Publishing'
  if (item.processingState === 'ready_to_publish') return 'Approved'
  if (item.processingState === 'rejected') return 'Rejected'
  if (item.processingState === 'skipped') return item.category === 'spam' ? 'Spam · Skipped' : 'Skipped'
  if (item.processingState.includes('failed')) return 'Failed'
  if (item.processingState === 'publish_uncertain') return 'Publish status uncertain'
  return 'Needs review'
}

export default function YouTubeReplyQueue({ videoId }: { videoId?: string }) {
  const [filter, setFilter] = useState<YouTubeQueueFilter>('needs_review')
  const [items, setItems] = useState<QueueItem[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [channelTitle, setChannelTitle] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<Record<string, string>>({})
  const [confirmingPublish, setConfirmingPublish] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const loadQueue = useCallback(async (nextFilter: YouTubeQueueFilter, nextPage = 0) => {
    setLoading(true)
    setError(null)
    setNotice(null)
    try {
      const params = new URLSearchParams({ filter: nextFilter, page: String(nextPage) })
      if (videoId) params.set('videoId', videoId)
      const response = await fetch(`/api/youtube/reply-queue?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not load the YouTube Reply Queue.')
      const nextItems = Array.isArray(data.items) ? data.items as QueueItem[] : []
      setItems(current => nextPage === 0 ? nextItems : [...current, ...nextItems])
      setDrafts(current => {
        const next = nextPage === 0 ? {} : { ...current }
        for (const item of nextItems) next[item.id] = item.draft ?? ''
        return next
      })
      setChannelTitle(typeof data.channelTitle === 'string' ? data.channelTitle : null)
      setVideo(data.video && typeof data.video === 'object' ? data.video as VideoContext : null)
      setPage(nextPage)
      setHasMore(data.hasMore === true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the YouTube Reply Queue.')
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    void loadQueue(filter)
  }, [filter, loadQueue])

  async function runAction(item: QueueItem, action: 'save' | 'approve' | 'reject' | 'begin_regenerate') {
    if (working[item.id]) return
    setWorking(current => ({ ...current, [item.id]: action }))
    setItemErrors(current => {
      const next = { ...current }
      delete next[item.id]
      return next
    })

    try {
      const response = await fetch(`/api/youtube/reply-queue/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expectedUpdatedAt: item.updatedAt,
          ...(action === 'save' ? { draft: drafts[item.id] ?? '' } : {}),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not update this reply.')
      await loadQueue(filter)
    } catch (actionError) {
      setItemErrors(current => ({
        ...current,
        [item.id]: actionError instanceof Error ? actionError.message : 'Could not update this reply.',
      }))
    } finally {
      setWorking(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
  }

  async function publishReply(item: QueueItem) {
    if (working[item.id]) return
    setWorking(current => ({ ...current, [item.id]: 'publish' }))
    setConfirmingPublish(current => ({ ...current, [item.id]: false }))
    setItemErrors(current => {
      const next = { ...current }
      delete next[item.id]
      return next
    })
    setNotice(null)

    try {
      const response = await fetch(`/api/youtube/reply-queue/${encodeURIComponent(item.id)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true, expectedUpdatedAt: item.updatedAt }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not publish this reply.')
      await loadQueue(filter)
      setNotice(data.detectedExisting === true
        ? 'An existing channel reply was verified and moved to Published.'
        : 'Reply published successfully. It is now available in the Published tab.')
    } catch (publishError) {
      const message = publishError instanceof Error ? publishError.message : 'Could not publish this reply.'
      await loadQueue(filter)
      setError(message)
    } finally {
      setWorking(current => {
        const next = { ...current }
        delete next[item.id]
        return next
      })
    }
  }

  return (
    <>
      <header className="page-header product-page-header youtube-queue-header">
        <div>
          <div className="t-eyebrow">{videoId ? 'YouTube / Videos / Comments' : 'YouTube / Reply Queue'}</div>
          <h1>{video?.title ?? (videoId ? 'Video comments' : 'Reply Queue')}</h1>
          <p>{videoId
            ? 'Manage this video’s synced comments, grounded AI drafts, approvals, and published replies.'
            : 'Review, edit, and approve saved drafts. Publishing happens only after an explicit confirmation.'}</p>
        </div>
        <Link href={videoId ? '/dashboard/youtube/videos' : '/dashboard/settings#youtube'} className="btn btn-quiet btn-sm">
          {videoId ? 'All videos' : 'YouTube settings'}
        </Link>
      </header>

      <div className="page-body youtube-queue-page">
        {video && (
          <section className="youtube-video-detail-context">
            <div className="youtube-video-detail-thumb">
              {video.thumbnailUrl ? (
                // YouTube thumbnail is rendered without transformation.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={video.thumbnailUrl} alt={`Thumbnail for ${video.title}`} referrerPolicy="no-referrer" />
              ) : <span>Thumbnail unavailable</span>}
            </div>
            <div>
              <strong>{video.title}</strong>
              <span>{video.viewCount ?? '—'} views · {video.commentCount ?? '—'} YouTube comments{video.privacyStatus ? ` · ${video.privacyStatus}` : ''}</span>
              <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`} target="_blank" rel="noreferrer">
                Open video <IconExternal s={11} />
              </a>
            </div>
          </section>
        )}
        <div className="youtube-queue-toolbar">
          <div className="youtube-queue-filters" role="tablist" aria-label="Reply Queue filters">
            {FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={filter === option.value}
                className={filter === option.value ? 'is-active' : ''}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="youtube-queue-channel">
            <span className="connection-dot" /> {channelTitle ?? 'Connected YouTube channel'}
          </div>
        </div>

        {error && <p className="simple-message is-error">{error}</p>}
        {notice && <p className="simple-message is-success">{notice}</p>}
        {loading && items.length === 0 && <div className="settings-loading-line skeleton" />}
        {!loading && !error && items.length === 0 && (
          <div className="youtube-queue-empty">
            <strong>No replies in {FILTERS.find(option => option.value === filter)?.label.toLowerCase()}.</strong>
            <p>{videoId
              ? 'This video has no comments in the selected workflow state.'
              : 'Sync comments and generate pending drafts from YouTube Settings to populate this queue.'}</p>
            <Link href={videoId ? '/dashboard/youtube/videos' : '/dashboard/settings#youtube'} className="btn btn-primary btn-sm">
              {videoId ? 'Back to videos' : 'Go to Settings'}
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <div className="youtube-queue-list" aria-live="polite">
            {items.map(item => {
              const editable = ['awaiting_approval', 'ready_to_publish'].includes(item.processingState)
                && !item.publishedReplyId
              const canApprove = item.processingState === 'awaiting_approval'
                && item.approvalStatus === 'pending'
                && item.replyVerificationStatus === 'verified_unpublished'
                && Boolean((drafts[item.id] ?? '').trim())
              const canReject = ['awaiting_approval', 'ready_to_publish', 'draft_failed'].includes(item.processingState)
                && !item.publishedReplyId
              const canRegenerate = canReject
                && item.replyVerificationStatus === 'verified_unpublished'
              const canPublish = ['ready_to_publish', 'publish_failed'].includes(item.processingState)
                && item.approvalStatus === 'approved'
                && item.replyVerificationStatus === 'verified_unpublished'
                && !item.publishedReplyId
                && !item.publishResultUncertain
                && Boolean(item.draft?.trim())
              const dirty = editable && (drafts[item.id] ?? '') !== (item.draft ?? '')
              const busy = Boolean(working[item.id])

              return (
                <article className="youtube-queue-card" key={item.id}>
                  <div className="youtube-queue-card-head">
                    <div>
                      <strong>{item.author}</strong>
                      <time dateTime={item.commentPublishedAt}>{new Date(item.commentPublishedAt).toLocaleString()}</time>
                    </div>
                    <div className="youtube-queue-badges">
                      {item.category && <span>{item.category.replace('_', ' ')}</span>}
                      {item.confidence !== null && <span>{Math.round(item.confidence * 100)}% confidence</span>}
                      <span data-state={item.replyVerificationStatus}>
                        {item.replyVerificationStatus === 'verified_unpublished'
                          ? 'Verified unanswered'
                          : item.replyVerificationStatus === 'verified_published' ? 'Reply verified' : 'Verification pending'}
                      </span>
                      {item.knowledgeGrounded && <span data-state="knowledge">Knowledge grounded · {item.knowledgeEntryCount}</span>}
                      {item.requiresManualReview && <span data-state="manual_review">Factual review</span>}
                      <span data-state={item.processingState}>{statusLabel(item)}</span>
                    </div>
                  </div>

                  <div className="youtube-queue-comment">
                    <span>Original comment</span>
                    <p>{item.comment}</p>
                    <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}&lc=${encodeURIComponent(item.youtubeCommentId)}`} target="_blank" rel="noreferrer">
                      View on YouTube <IconExternal s={12} />
                    </a>
                  </div>

                  {item.draft !== null || editable ? (
                    <div className="youtube-queue-draft">
                      <label htmlFor={`queue-draft-${item.id}`}>AI reply draft</label>
                      <textarea
                        id={`queue-draft-${item.id}`}
                        value={drafts[item.id] ?? ''}
                        onChange={event => setDrafts(current => ({
                          ...current,
                          [item.id]: event.target.value.slice(0, 1000),
                        }))}
                        maxLength={1000}
                        rows={4}
                        disabled={!editable || busy}
                      />
                      {item.hasManualEdit && <small>Manually edited</small>}
                    </div>
                  ) : null}
                  {item.lastError && <p className="simple-message is-error">{item.lastError}</p>}
                  {item.requiresManualReview && (
                    <p className="youtube-queue-review-flag">
                      Manual factual review required. {item.manualReviewReason ?? 'The available context may not support a complete answer.'}
                    </p>
                  )}

                  <div className="youtube-queue-actions">
                    {editable && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        disabled={!dirty || busy || !(drafts[item.id] ?? '').trim()}
                        onClick={() => runAction(item, 'save')}
                      >
                        {working[item.id] === 'save' ? 'Saving…' : dirty ? 'Save Draft' : 'Saved'}
                      </button>
                    )}
                    {canRegenerate && (
                      <button type="button" className="btn btn-quiet btn-sm" disabled={busy || dirty} onClick={() => runAction(item, 'begin_regenerate')}>
                        <span className={working[item.id] === 'begin_regenerate' ? 'spin' : undefined}><IconRefresh s={12} /></span>
                        {working[item.id] === 'begin_regenerate' ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    )}
                    {canReject && (
                      <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => runAction(item, 'reject')}>
                        {working[item.id] === 'reject' ? 'Rejecting…' : 'Reject'}
                      </button>
                    )}
                    {canApprove && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy || dirty} onClick={() => runAction(item, 'approve')}>
                        {working[item.id] === 'approve' ? 'Approving…' : dirty ? 'Save before approving' : 'Approve'}
                      </button>
                    )}
                    {canPublish && !confirmingPublish[item.id] && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => setConfirmingPublish(current => ({ ...current, [item.id]: true }))}
                      >
                        {working[item.id] === 'publish' ? 'Publishing…' : 'Publish Reply'}
                      </button>
                    )}
                    {canPublish && confirmingPublish[item.id] && (
                      <div className="youtube-queue-publish-confirm" role="group" aria-label="Confirm YouTube reply publishing">
                        <span>Publish this saved reply to YouTube?</span>
                        <button
                          type="button"
                          className="btn btn-quiet btn-sm"
                          disabled={busy}
                          onClick={() => setConfirmingPublish(current => ({ ...current, [item.id]: false }))}
                        >
                          Cancel
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => publishReply(item)}>
                          {working[item.id] === 'publish' ? 'Publishing…' : 'Confirm Publish'}
                        </button>
                      </div>
                    )}
                    {item.processingState === 'publishing' && (
                      <button type="button" className="btn btn-primary btn-sm" disabled>Publishing…</button>
                    )}
                    {item.processingState === 'published' && (
                      item.publishedReplyUrl
                        ? <a href={item.publishedReplyUrl} target="_blank" rel="noreferrer" className="btn btn-quiet btn-sm">View published reply</a>
                        : <span className="youtube-queue-published-label">Published</span>
                    )}
                  </div>
                  {itemErrors[item.id] && <p className="youtube-comment-ai-error" role="alert">{itemErrors[item.id]}</p>}
                </article>
              )
            })}
            {hasMore && (
              <button type="button" className="btn btn-quiet btn-sm youtube-comments-more" disabled={loading} onClick={() => loadQueue(filter, page + 1)}>
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
