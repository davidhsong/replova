import 'server-only'

import pLimit from 'p-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildYouTubeSyncQueueRow } from './youtubeAutomationPolicy'
import { fetchYouTubeCommentsPage } from './youtubeComments'

export type YouTubeSyncPageSummary = {
  fetched: number
  inserted: number
  updated: number
  publishedDetected: number
  verificationUnknown: number
  publishedUpdateFailures: number
  nextPageToken: string | null
  partial: boolean
}

type ExistingRow = {
  youtube_comment_id: string
  processing_state: string
  reply_verification_checked_at: string | null
  reply_verification_error: string | null
}

export class YouTubeSyncPersistenceError extends Error {
  constructor(public readonly code: string) {
    super('Unable to persist YouTube comments.')
    this.name = 'YouTubeSyncPersistenceError'
  }
}

export async function syncYouTubeCommentsPage({
  admin,
  connectionId,
  channelId,
  accessToken,
  pageToken,
  maxResults,
  signal,
}: {
  admin: SupabaseClient
  connectionId: string
  channelId: string
  accessToken: string
  pageToken?: string
  maxResults: number
  signal?: AbortSignal
}): Promise<YouTubeSyncPageSummary> {
  const page = await fetchYouTubeCommentsPage({
    accessToken,
    channelId,
    pageToken,
    maxResults: Math.max(1, Math.min(maxResults, 100)),
    signal,
  })
  const checkedAt = new Date().toISOString()
  const commentIds = page.comments.map(comment => comment.id)
  const { data: existing, error: existingError } = commentIds.length > 0
    ? await admin
      .from('youtube_comment_queue')
      .select('youtube_comment_id, processing_state, reply_verification_checked_at, reply_verification_error')
      .eq('connection_id', connectionId)
      .in('youtube_comment_id', commentIds)
    : { data: [], error: null }

  if (existingError) throw new YouTubeSyncPersistenceError(existingError.code)

  const existingById = new Map((existing ?? []).map(row => [
    row.youtube_comment_id as string,
    row as ExistingRow,
  ]))
  const queueRows = page.comments.map(comment => buildYouTubeSyncQueueRow({
    connectionId,
    comment,
    current: existingById.get(comment.id),
    checkedAt,
  }))

  if (queueRows.length > 0) {
    const { error } = await admin
      .from('youtube_comment_queue')
      .upsert(queueRows, { onConflict: 'connection_id,youtube_comment_id' })
    if (error) throw new YouTubeSyncPersistenceError(error.code)
  }

  const published = page.comments.filter(comment => comment.replyStatus.status === 'published')
  const updateLimit = pLimit(5)
  const publishedUpdates = await Promise.all(published.map(comment => updateLimit(async () => {
    if (comment.replyStatus.status !== 'published') return false
    const { error } = await admin
      .from('youtube_comment_queue')
      .update({
        processing_state: 'published',
        published_reply_id: comment.replyStatus.replyId,
        published_reply_url: comment.publishedReplyUrl,
        published_at: comment.replyStatus.publishedAt ?? checkedAt,
      })
      .eq('connection_id', connectionId)
      .eq('youtube_comment_id', comment.id)
    return !error
  })))

  const publishedUpdateFailures = publishedUpdates.filter(success => !success).length
  const verificationUnknown = page.comments.filter(comment => comment.replyStatus.status === 'unknown').length
  return {
    fetched: page.comments.length,
    inserted: page.comments.filter(comment => !existingById.has(comment.id)).length,
    updated: page.comments.filter(comment => existingById.has(comment.id)).length,
    publishedDetected: published.length - publishedUpdateFailures,
    verificationUnknown,
    publishedUpdateFailures,
    nextPageToken: page.nextPageToken,
    partial: publishedUpdateFailures > 0 || verificationUnknown > 0,
  }
}
