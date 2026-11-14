import { createHash, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import {
  classifyAndGenerateYouTubeDraft,
  generateYouTubeReply,
} from '@/lib/generateYouTubeReply'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  canUseYouTubeQueueAction,
  sanitizeYouTubeQueueDraft,
  type YouTubeQueueAction,
} from '@/lib/youtubeQueuePolicy'
import { createClient } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HOURLY_DRAFT_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000
const regenerationInFlight = new Set<string>()

type ActionBody = {
  action?: unknown
  draft?: unknown
  expectedUpdatedAt?: unknown
}

type ConnectionRow = { id: string; channel_title: string | null }
type QueueRow = {
  id: string
  connection_id: string
  author_display_name: string | null
  comment_text: string
  category: string | null
  category_confidence: number | null
  processing_state: string
  approval_status: string
  generated_reply: string | null
  edited_reply: string | null
  published_reply_id: string | null
  reply_verification_status: string
  updated_at: string
  lock_token: string | null
}

function rpcRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null
  return data && typeof data === 'object' ? data as T : null
}

function errorResponse(message: string) {
  if (message.includes('queue_item_stale')) {
    return NextResponse.json({ error: 'This draft changed in another session. Refresh the queue and try again.' }, { status: 409 })
  }
  if (message.includes('queue_item_not_found')) {
    return NextResponse.json({ error: 'Reply Queue item not found.' }, { status: 404 })
  }
  if (message.includes('queue_item_locked')) {
    return NextResponse.json({ error: 'Published or publishing replies cannot be changed.' }, { status: 409 })
  }
  if (message.includes('invalid_') || message.includes('unsupported_queue_action')) {
    return NextResponse.json({ error: 'That action is not valid for the current reply state.' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Unable to update the YouTube Reply Queue.' }, { status: 500 })
}

export async function PATCH(
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

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: ActionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const allowedActions: YouTubeQueueAction[] = ['save', 'approve', 'reject', 'begin_regenerate']
  const action = typeof body.action === 'string' && allowedActions.includes(body.action as YouTubeQueueAction)
    ? body.action as YouTubeQueueAction
    : null
  const expectedUpdatedAt = typeof body.expectedUpdatedAt === 'string' ? body.expectedUpdatedAt : ''
  if (!action || !expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ error: 'A valid action and queue version are required.' }, { status: 400 })
  }
  const draft = action === 'save' ? sanitizeYouTubeQueueDraft(body.draft) : null
  if (action === 'save' && !draft) {
    return NextResponse.json({ error: 'Drafts must contain between 1 and 1,000 characters.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('id, channel_title')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()
  if (connectionError) {
    console.error('[YouTube queue action] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before updating the Reply Queue.' }, { status: 404 })
  }

  const { data: current, error: currentError } = await admin
    .from('youtube_comment_queue')
    .select('id, connection_id, author_display_name, comment_text, category, category_confidence, processing_state, approval_status, generated_reply, edited_reply, published_reply_id, reply_verification_status, updated_at, lock_token')
    .eq('id', id)
    .eq('connection_id', connection.id)
    .maybeSingle<QueueRow>()
  if (currentError) {
    console.error('[YouTube queue action] Queue lookup failed:', currentError.code)
    return NextResponse.json({ error: 'Unable to load the Reply Queue item.' }, { status: 500 })
  }
  if (!current) return NextResponse.json({ error: 'Reply Queue item not found.' }, { status: 404 })
  if (current.updated_at !== expectedUpdatedAt) {
    return NextResponse.json({ error: 'This draft changed in another session. Refresh the queue and try again.' }, { status: 409 })
  }
  if (!canUseYouTubeQueueAction({
    processingState: current.processing_state,
    approvalStatus: current.approval_status,
    replyVerificationStatus: current.reply_verification_status,
    publishedReplyId: current.published_reply_id,
  }, action)) {
    return NextResponse.json({ error: 'That action is not valid for the current reply state.' }, { status: 409 })
  }

  const runId = randomUUID()

  if (action !== 'begin_regenerate') {
    const { data, error } = await admin.rpc('transition_youtube_reply_queue_item', {
      p_connection_id: connection.id,
      p_queue_id: current.id,
      p_expected_updated_at: expectedUpdatedAt,
      p_action: action,
      p_draft: draft,
      p_run_id: runId,
    })
    if (error) {
      console.error('[YouTube queue action] Transition failed:', error.code)
      return errorResponse(error.message)
    }
    return NextResponse.json({ item: rpcRow<QueueRow>(data) })
  }

  const userBucket = createHash('sha256').update(user.id).digest('hex').slice(0, 20)
  const inFlightKey = `${userBucket}:${current.id}`
  if (regenerationInFlight.has(inFlightKey)) {
    return NextResponse.json({ error: 'This reply is already being regenerated.' }, { status: 429 })
  }

  const usageOperation = `youtube_reply_draft:${userBucket}`
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const [{ count, error: usageError }, { data: budget, error: budgetError }] = await Promise.all([
    admin.from('api_usage_log')
      .select('*', { count: 'exact', head: true })
      .eq('operation', usageOperation)
      .gte('created_at', windowStart),
    admin.from('api_budget_state')
      .select('spent_usd, budget_usd')
      .eq('id', 'default')
      .maybeSingle<{ spent_usd: number; budget_usd: number }>(),
  ])
  if (usageError || budgetError || !budget) {
    return NextResponse.json({ error: 'AI regeneration is temporarily unavailable.' }, { status: 503 })
  }
  if ((count ?? 0) >= HOURLY_DRAFT_LIMIT) {
    return NextResponse.json({ error: 'You have reached the AI draft limit. Try again in about an hour.' }, { status: 429 })
  }
  if (budget.spent_usd >= budget.budget_usd) {
    return NextResponse.json({ error: 'The configured AI budget has been reached.' }, { status: 429 })
  }

  regenerationInFlight.add(inFlightKey)
  let claimed: QueueRow | null = null
  try {
    const { data, error } = await admin.rpc('transition_youtube_reply_queue_item', {
      p_connection_id: connection.id,
      p_queue_id: current.id,
      p_expected_updated_at: expectedUpdatedAt,
      p_action: 'begin_regenerate',
      p_draft: null,
      p_run_id: runId,
    })
    if (error) return errorResponse(error.message)
    claimed = rpcRow<QueueRow>(data)
    if (!claimed) throw new Error('regeneration_claim_missing')
    if (!claimed.lock_token) throw new Error('regeneration_lease_missing')

    const previousDraft = claimed.edited_reply ?? claimed.generated_reply
    let nextDraft: string | null
    let category: string | null = claimed.category
    let confidence: number | null = claimed.category_confidence
    let skip = false

    if (previousDraft) {
      nextDraft = await generateYouTubeReply({
        channelTitle: connection.channel_title ?? 'your YouTube channel',
        author: claimed.author_display_name ?? 'Viewer',
        commentText: claimed.comment_text,
        previousDraft,
        usageOperation,
      })
    } else {
      const decision = await classifyAndGenerateYouTubeDraft({
        channelTitle: connection.channel_title ?? 'your YouTube channel',
        author: claimed.author_display_name ?? 'Viewer',
        commentText: claimed.comment_text,
        usageOperation,
      })
      nextDraft = decision.reply
      category = decision.category
      confidence = decision.confidence
      skip = !decision.shouldDraft
    }

    const { data: finished, error: finishError } = await admin.rpc('finish_youtube_reply_regeneration', {
      p_connection_id: connection.id,
      p_queue_id: claimed.id,
      p_lock_token: claimed.lock_token,
      p_run_id: runId,
      p_draft: nextDraft,
      p_category: category,
      p_confidence: confidence,
      p_skip: skip,
    })
    if (finishError) throw new Error('regeneration_save_failed')
    return NextResponse.json({ item: finished })
  } catch (error) {
    if (claimed?.lock_token) {
      await admin.rpc('fail_youtube_reply_regeneration', {
        p_connection_id: connection.id,
        p_queue_id: claimed.id,
        p_lock_token: claimed.lock_token,
        p_run_id: runId,
        p_error_code: error instanceof Error ? error.message.slice(0, 200) : 'regeneration_failed',
      })
    }
    console.error('[YouTube queue action] Regeneration failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to regenerate this reply right now.' }, { status: 502 })
  } finally {
    regenerationInFlight.delete(inFlightKey)
  }
}
