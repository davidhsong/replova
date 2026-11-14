import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import pLimit from 'p-limit'
import { fetchYouTubeCommentsPage, YouTubeCommentsError, type FetchedYouTubeComment } from '@/lib/youtubeComments'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidYouTubeAccessToken, type YouTubeConnectionTokenFields } from '@/lib/youtubeAuth'
import { refreshYouTubeVideoMetadata } from '@/lib/youtubeKnowledge'
import { createClient } from '@/utils/supabase/server'

type ConnectionRow = YouTubeConnectionTokenFields & {
  id: string
  channel_id: string
  channel_title: string | null
}

type SyncSummary = {
  fetched: number
  inserted: number
  updated: number
  publishedDetected: number
  verificationUnknown: number
  pages: number
  partial: boolean
  videoContextUnavailable: boolean
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('id, user_id, channel_id, channel_title, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()

  if (connectionError) {
    console.error('[YouTube sync] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) return NextResponse.json({ error: 'Connect YouTube before syncing comments.' }, { status: 404 })

  const connectionId = connection.id
  const runId = randomUUID()
  async function log(
    eventType: 'sync_started' | 'sync_succeeded' | 'sync_failed',
    severity: 'info' | 'warning' | 'error',
    message: string,
    metadata: Record<string, unknown> = {},
    errorCode?: string
  ) {
    const { error } = await admin.from('youtube_automation_logs').insert({
      connection_id: connectionId,
      run_id: runId,
      event_type: eventType,
      severity,
      message,
      metadata,
      error_code: errorCode ?? null,
    })
    if (error) console.error('[YouTube sync] Log write failed:', error.code)
  }

  await log('sync_started', 'info', 'Manual YouTube comment sync started.')

  const { data: settings, error: settingsError } = await admin
    .from('youtube_automation_settings')
    .select('max_comments_per_sync')
    .eq('connection_id', connection.id)
    .maybeSingle<{ max_comments_per_sync: number }>()

  if (settingsError) {
    await log('sync_failed', 'error', 'Unable to load automation settings.', {}, settingsError.code)
    return NextResponse.json({ error: 'Unable to load YouTube automation settings.' }, { status: 500 })
  }
  const batchLimit = Math.max(1, Math.min(100, settings?.max_comments_per_sync ?? 50))

  let accessToken: string | null
  try {
    accessToken = await getValidYouTubeAccessToken(connection, admin)
  } catch {
    await log('sync_failed', 'error', 'YouTube token refresh failed.', {}, 'token_refresh_failed')
    return NextResponse.json({ error: 'YouTube authorization could not be refreshed. Try again.' }, { status: 502 })
  }
  if (!accessToken) {
    await log('sync_failed', 'error', 'YouTube authorization expired.', {}, 'authorization_expired')
    return NextResponse.json({ error: 'YouTube authorization expired. Reconnect YouTube and try again.' }, { status: 401 })
  }

  const fetched: FetchedYouTubeComment[] = []
  let pageToken: string | undefined
  let pages = 0
  let fetchFailure: YouTubeCommentsError | null = null

  do {
    try {
      const page = await fetchYouTubeCommentsPage({
        accessToken,
        channelId: connection.channel_id,
        pageToken,
        maxResults: Math.min(100, batchLimit - fetched.length),
      })
      fetched.push(...page.comments.slice(0, batchLimit - fetched.length))
      pageToken = page.nextPageToken ?? undefined
      pages += 1
    } catch (error) {
      fetchFailure = error instanceof YouTubeCommentsError
        ? error
        : new YouTubeCommentsError('YouTube comments are temporarily unavailable.', 502, 'unexpected')
      break
    }
  } while (pageToken && fetched.length < batchLimit)

  if (fetchFailure && fetched.length === 0) {
    await log('sync_failed', 'error', fetchFailure.message, { pages }, fetchFailure.reason)
    const status = fetchFailure.reason === 'quotaExceeded' || fetchFailure.reason === 'dailyLimitExceeded'
      ? 429
      : fetchFailure.status >= 400 && fetchFailure.status < 500 ? fetchFailure.status : 502
    return NextResponse.json({ error: fetchFailure.message }, { status })
  }

  let videoContextUnavailable = false
  try {
    await refreshYouTubeVideoMetadata({
      admin,
      connection: {
        id: connection.id,
        userId: connection.user_id,
        channelId: connection.channel_id,
        channelTitle: connection.channel_title,
      },
      accessToken,
      videoIds: fetched.map(comment => comment.videoId),
    })
  } catch {
    videoContextUnavailable = true
  }

  const checkedAt = new Date().toISOString()
  const commentIds = fetched.map(comment => comment.id)
  const { data: existing, error: existingError } = commentIds.length > 0
    ? await admin
      .from('youtube_comment_queue')
      .select('youtube_comment_id, processing_state, reply_verification_status, reply_verification_checked_at, reply_verification_error')
      .eq('connection_id', connection.id)
      .in('youtube_comment_id', commentIds)
    : { data: [], error: null }

  if (existingError) {
    await log('sync_failed', 'error', 'Unable to inspect the existing comment queue.', {}, existingError.code)
    return NextResponse.json({ error: 'Unable to synchronize the YouTube comment queue.' }, { status: 500 })
  }

  const existingById = new Map((existing ?? []).map(row => [row.youtube_comment_id as string, row]))
  const existingIds = new Set(existingById.keys())
  const queueRows = fetched.map(comment => {
    const current = existingById.get(comment.id)
    const preservePublishedVerification = current?.processing_state === 'published'
      && comment.replyStatus.status !== 'published'

    return {
      connection_id: connection.id,
      youtube_comment_id: comment.id,
      youtube_thread_id: comment.threadId,
      video_id: comment.videoId,
      author_channel_id: comment.authorChannelId,
      author_display_name: comment.author,
      comment_text: comment.text,
      comment_published_at: comment.date,
      comment_updated_at: comment.updatedAt,
      reply_count: comment.replyCount,
      reply_verification_status: preservePublishedVerification
        ? 'verified_published'
        : comment.replyStatus.status === 'published'
          ? 'verified_published'
          : comment.replyStatus.status === 'not_published' ? 'verified_unpublished' : 'unknown',
      reply_verification_checked_at: preservePublishedVerification
        ? current.reply_verification_checked_at
        : checkedAt,
      reply_verification_error: preservePublishedVerification
        ? current.reply_verification_error
        : comment.replyStatus.status === 'unknown' ? comment.replyStatus.reason : null,
    }
  })

  if (queueRows.length > 0) {
    const { error: upsertError } = await admin
      .from('youtube_comment_queue')
      .upsert(queueRows, { onConflict: 'connection_id,youtube_comment_id' })
    if (upsertError) {
      await log('sync_failed', 'error', 'Queue upsert failed.', { fetched: fetched.length }, upsertError.code)
      return NextResponse.json({ error: 'Unable to persist YouTube comments.' }, { status: 500 })
    }
  }

  const published = fetched.filter(comment => comment.replyStatus.status === 'published')
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
      .eq('connection_id', connection.id)
      .eq('youtube_comment_id', comment.id)
    if (error) console.error('[YouTube sync] Published-state update failed:', error.code)
    return !error
  })))

  const publishedUpdateFailures = publishedUpdates.filter(success => !success).length
  const verificationUnknown = fetched.filter(comment => comment.replyStatus.status === 'unknown').length
  const summary: SyncSummary = {
    fetched: fetched.length,
    inserted: fetched.filter(comment => !existingIds.has(comment.id)).length,
    updated: fetched.filter(comment => existingIds.has(comment.id)).length,
    publishedDetected: published.length - publishedUpdateFailures,
    verificationUnknown,
    pages,
    partial: Boolean(fetchFailure || publishedUpdateFailures || verificationUnknown || videoContextUnavailable),
    videoContextUnavailable,
  }

  if (summary.partial) {
    await log(
      'sync_failed',
      'warning',
      'Manual YouTube comment sync completed with partial results.',
      { ...summary, fetchError: fetchFailure?.reason ?? null, publishedUpdateFailures },
      fetchFailure?.reason ?? (verificationUnknown ? 'reply_verification_unknown' : 'published_update_failed')
    )
  } else {
    await log('sync_succeeded', 'info', 'Manual YouTube comment sync completed.', summary)
  }

  return NextResponse.json(summary, { status: summary.partial ? 207 : 200 })
}
