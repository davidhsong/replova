import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getValidYouTubeAccessToken,
  type YouTubeConnectionTokenFields,
} from '@/lib/youtubeAuth'
import { verifyAndPublishYouTubeReply } from '@/lib/youtubePublishing'
import { canManuallyPublishYouTubeQueueItem } from '@/lib/youtubeQueuePolicy'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type ConnectionRow = YouTubeConnectionTokenFields & {
  id: string
  channel_id: string
}

type QueueRow = {
  id: string
  youtube_comment_id: string
  youtube_thread_id: string
  processing_state: string
  approval_status: string
  edited_reply: string | null
  generated_reply: string | null
  published_reply_id: string | null
  publish_result_uncertain: boolean
  reply_verification_status: string
  updated_at: string
  lock_token: string | null
}

function rpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null
  return data && typeof data === 'object' ? data as T : null
}

function claimError(message: string) {
  if (message.includes('queue_item_stale')) {
    return NextResponse.json({ error: 'This reply changed in another session. Refresh the queue and try again.' }, { status: 409 })
  }
  if (message.includes('queue_item_not_found')) {
    return NextResponse.json({ error: 'Reply Queue item not found.' }, { status: 404 })
  }
  if (message.includes('invalid_') || message.includes('duplicate key')) {
    return NextResponse.json({ error: 'This reply is no longer available for manual publishing.' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Unable to claim this reply for publishing.' }, { status: 500 })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid Reply Queue item.' }, { status: 400 })
  }

  let body: { confirmed?: unknown; expectedUpdatedAt?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : ''
  if (body.confirmed !== true || !expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ error: 'Explicit confirmation and a valid queue version are required.' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('id, user_id, channel_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()
  if (connectionError) {
    console.error('[YouTube queue publish] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before publishing replies.' }, { status: 404 })
  }

  const { data: current, error: currentError } = await admin
    .from('youtube_comment_queue')
    .select('id, youtube_comment_id, youtube_thread_id, processing_state, approval_status, edited_reply, generated_reply, published_reply_id, publish_result_uncertain, reply_verification_status, updated_at, lock_token')
    .eq('id', id)
    .eq('connection_id', connection.id)
    .maybeSingle<QueueRow>()
  if (currentError) {
    console.error('[YouTube queue publish] Queue lookup failed:', currentError.code)
    return NextResponse.json({ error: 'Unable to load the Reply Queue item.' }, { status: 500 })
  }
  if (!current) return NextResponse.json({ error: 'Reply Queue item not found.' }, { status: 404 })
  if (current.updated_at !== expectedUpdatedAt) {
    return NextResponse.json({ error: 'This reply changed in another session. Refresh the queue and try again.' }, { status: 409 })
  }

  const replyText = current.edited_reply ?? current.generated_reply
  if (!canManuallyPublishYouTubeQueueItem({
    processingState: current.processing_state,
    approvalStatus: current.approval_status,
    replyVerificationStatus: current.reply_verification_status,
    publishedReplyId: current.published_reply_id,
    publishResultUncertain: current.publish_result_uncertain,
    draft: replyText,
  })) {
    return NextResponse.json({ error: 'This reply is not eligible for manual publishing.' }, { status: 409 })
  }

  let accessToken: string | null
  try {
    accessToken = await getValidYouTubeAccessToken(connection, admin)
  } catch {
    return NextResponse.json({ error: 'YouTube authorization could not be refreshed. Try again.' }, { status: 502 })
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'YouTube authorization expired. Reconnect YouTube and try again.' }, { status: 401 })
  }

  const runId = randomUUID()
  const idempotencyKey = `manual-publish:${current.id}:${expectedUpdatedAt}`
  const { data: claimData, error: claimRpcError } = await admin.rpc('claim_youtube_manual_publish', {
    p_connection_id: connection.id,
    p_queue_id: current.id,
    p_expected_updated_at: expectedUpdatedAt,
    p_run_id: runId,
    p_idempotency_key: idempotencyKey,
  })
  if (claimRpcError) {
    console.error('[YouTube queue publish] Claim failed:', claimRpcError.code)
    return claimError(claimRpcError.message)
  }

  const claimed = rpcRow<QueueRow>(claimData)
  if (!claimed?.lock_token) {
    return NextResponse.json({ error: 'Unable to establish a durable publishing claim.' }, { status: 500 })
  }
  const claimedReplyText = claimed.edited_reply ?? claimed.generated_reply
  if (!claimedReplyText) {
    await admin.rpc('fail_youtube_manual_publish', {
      p_connection_id: connection.id,
      p_queue_id: claimed.id,
      p_lock_token: claimed.lock_token,
      p_run_id: runId,
      p_idempotency_key: idempotencyKey,
      p_uncertain: false,
      p_error_code: 'missing_claimed_draft',
      p_error_message: 'The approved draft could not be loaded. Save and approve it again.',
    })
    return NextResponse.json({ error: 'The approved draft could not be loaded. Save and approve it again.' }, { status: 409 })
  }

  try {
    const outcome = await verifyAndPublishYouTubeReply({
      accessToken,
      channelId: connection.channel_id,
      commentId: claimed.youtube_comment_id,
      threadId: claimed.youtube_thread_id,
      replyText: claimedReplyText,
    })

    if (outcome.status === 'failed') {
      const blockRetry = outcome.uncertain || outcome.blocked
      const { error: failError } = await admin.rpc('fail_youtube_manual_publish', {
        p_connection_id: connection.id,
        p_queue_id: claimed.id,
        p_lock_token: claimed.lock_token,
        p_run_id: runId,
        p_idempotency_key: idempotencyKey,
        p_uncertain: blockRetry,
        p_error_code: outcome.reason,
        p_error_message: outcome.message,
      })
      if (failError) {
        console.error('[YouTube queue publish] Failure persistence failed:', failError.code)
        return NextResponse.json({
          error: 'Replova could not safely save the publishing result. Check YouTube before retrying.',
          uncertain: true,
          blocked: true,
        }, { status: 502 })
      }
      return NextResponse.json({
        error: outcome.message,
        uncertain: blockRetry,
        blocked: blockRetry,
      }, { status: outcome.httpStatus })
    }

    const detectedExisting = outcome.status === 'already_published'
    const { error: finishError } = await admin.rpc('finish_youtube_manual_publish', {
      p_connection_id: connection.id,
      p_queue_id: claimed.id,
      p_lock_token: claimed.lock_token,
      p_run_id: runId,
      p_idempotency_key: idempotencyKey,
      p_reply_id: outcome.replyId,
      p_reply_url: outcome.replyUrl,
      p_published_at: outcome.publishedAt,
      p_detected_existing: detectedExisting,
    })
    if (finishError) {
      console.error('[YouTube queue publish] Success persistence failed:', finishError.code)
      await admin.rpc('fail_youtube_manual_publish', {
        p_connection_id: connection.id,
        p_queue_id: claimed.id,
        p_lock_token: claimed.lock_token,
        p_run_id: runId,
        p_idempotency_key: idempotencyKey,
        p_uncertain: true,
        p_error_code: 'publish_finalize_failed',
        p_error_message: 'YouTube may have published the reply, but Replova could not save the result. Check YouTube before retrying.',
      })
      return NextResponse.json({
        error: 'YouTube may have published the reply, but Replova could not save the result. Check YouTube before retrying.',
        uncertain: true,
        blocked: true,
      }, { status: 502 })
    }

    return NextResponse.json({
      published: true,
      detectedExisting,
      replyId: outcome.replyId,
      replyUrl: outcome.replyUrl,
    })
  } catch (error) {
    console.error('[YouTube queue publish] Unexpected publishing failure:', error instanceof Error ? error.name : 'UnknownError')
    await admin.rpc('fail_youtube_manual_publish', {
      p_connection_id: connection.id,
      p_queue_id: claimed.id,
      p_lock_token: claimed.lock_token,
      p_run_id: runId,
      p_idempotency_key: idempotencyKey,
      p_uncertain: true,
      p_error_code: 'unexpected_publish_failure',
      p_error_message: 'The publish result is uncertain. Check YouTube before retrying.',
    })
    return NextResponse.json({
      error: 'The publish result is uncertain. Check YouTube before retrying.',
      uncertain: true,
      blocked: true,
    }, { status: 502 })
  }
}
