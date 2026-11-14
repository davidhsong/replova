import { createHash, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { classifyAndGenerateYouTubeDraft } from '@/lib/generateYouTubeReply'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isClaimedYouTubeDraftSafe } from '@/lib/youtubeDraftingPolicy'
import { createClient } from '@/utils/supabase/server'

const HOURLY_DRAFT_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000
const draftingInFlight = new Set<string>()

type ConnectionRow = { id: string; channel_id: string; channel_title: string | null }
type SettingsRow = { max_drafts_per_run: number; max_draft_attempts: number }
type ClaimedRow = {
  id: string
  connection_id: string
  author_channel_id: string | null
  author_display_name: string | null
  comment_text: string
  processing_state: string
  reply_verification_status: string
  draft_attempts: number
  lock_token: string | null
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('id, channel_id, channel_title')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()

  if (connectionError) {
    console.error('[YouTube drafting] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before generating pending drafts.' }, { status: 404 })
  }
  const connectionId = connection.id

  const { error: ensureSettingsError } = await admin
    .from('youtube_automation_settings')
    .upsert({ connection_id: connection.id }, { onConflict: 'connection_id', ignoreDuplicates: true })
  if (ensureSettingsError) {
    console.error('[YouTube drafting] Settings initialization failed:', ensureSettingsError.code)
    return NextResponse.json({ error: 'Unable to load YouTube automation settings.' }, { status: 500 })
  }

  const { data: settings, error: settingsError } = await admin
    .from('youtube_automation_settings')
    .select('max_drafts_per_run, max_draft_attempts')
    .eq('connection_id', connection.id)
    .single<SettingsRow>()
  if (settingsError || !settings) {
    console.error('[YouTube drafting] Settings lookup failed:', settingsError?.code)
    return NextResponse.json({ error: 'Unable to load YouTube automation settings.' }, { status: 500 })
  }

  const userBucket = createHash('sha256').update(user.id).digest('hex').slice(0, 20)
  if (draftingInFlight.has(userBucket)) {
    return NextResponse.json({ error: 'Pending drafts are already being generated.' }, { status: 429 })
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
    console.error('[YouTube drafting] Budget lookup failed:', usageError?.code ?? budgetError?.code)
    return NextResponse.json({ error: 'AI drafting is temporarily unavailable.' }, { status: 503 })
  }
  if (budget.spent_usd >= budget.budget_usd) {
    return NextResponse.json({ error: 'The configured AI budget has been reached.' }, { status: 429 })
  }

  const remainingHourly = Math.max(0, HOURLY_DRAFT_LIMIT - (count ?? 0))
  if (remainingHourly === 0) {
    return NextResponse.json({ error: 'You have reached the AI draft limit. Try again in about an hour.' }, { status: 429 })
  }
  const batchSize = Math.max(1, Math.min(settings.max_drafts_per_run, remainingHourly, 100))
  const runId = randomUUID()
  const workerId = `manual:${userBucket}:${runId.slice(0, 8)}`

  async function log(row: {
    queueId?: string
    eventType: 'draft_started' | 'draft_succeeded' | 'draft_failed'
    severity?: 'info' | 'warning' | 'error'
    attemptNumber?: number
    message: string
    errorCode?: string
    metadata?: Record<string, unknown>
  }) {
    const { error } = await admin.from('youtube_automation_logs').insert({
      connection_id: connectionId,
      queue_id: row.queueId ?? null,
      run_id: runId,
      event_type: row.eventType,
      severity: row.severity ?? 'info',
      attempt_number: row.attemptNumber ?? null,
      message: row.message,
      error_code: row.errorCode ?? null,
      metadata: row.metadata ?? {},
    })
    if (error) console.error('[YouTube drafting] Log write failed:', error.code)
  }

  draftingInFlight.add(userBucket)
  try {
    const { count: selfSkipped, error: selfSkipError } = await admin
      .from('youtube_comment_queue')
      .update({
        category: 'self',
        category_confidence: 1,
        processing_state: 'skipped',
        approval_status: 'pending',
        generated_reply: null,
        edited_reply: null,
        lock_token: null,
        locked_by: null,
        locked_at: null,
        lease_expires_at: null,
      }, { count: 'exact' })
      .eq('connection_id', connection.id)
      .eq('reply_verification_status', 'verified_unpublished')
      .eq('author_channel_id', connection.channel_id)
      .in('processing_state', ['discovered', 'queued_for_draft', 'draft_failed'])
    if (selfSkipError) console.error('[YouTube drafting] Self-comment update failed:', selfSkipError.code)

    const { data: claimedData, error: claimError } = await admin.rpc('claim_youtube_draft_items', {
      batch_size: batchSize,
      worker_id: workerId,
      lease_minutes: 15,
      connection_filter: connection.id,
      require_automation_enabled: false,
    })
    if (claimError) {
      console.error('[YouTube drafting] Claim failed:', claimError.code)
      return NextResponse.json({
        error: 'Unable to claim pending comments. Confirm migration 020 has been applied.',
      }, { status: 500 })
    }

    const claimed = (claimedData ?? []) as ClaimedRow[]
    let drafted = 0
    let skipped = 0
    let failed = 0

    for (const item of claimed) {
      if (!item.lock_token || !isClaimedYouTubeDraftSafe({
        processingState: item.processing_state,
        replyVerificationStatus: item.reply_verification_status,
        authorChannelId: item.author_channel_id,
        connectedChannelId: connection.channel_id,
      })) {
        failed += 1
        await admin.from('youtube_comment_queue').update({
          processing_state: item.author_channel_id === connection.channel_id ? 'skipped' : 'discovered',
          category: item.author_channel_id === connection.channel_id ? 'self' : null,
          category_confidence: item.author_channel_id === connection.channel_id ? 1 : null,
          lock_token: null,
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
          last_error_stage: 'draft',
          last_error_code: 'unsafe_claim',
          last_error_message: 'Draft claim failed the server verification guard.',
        }).eq('id', item.id).eq('connection_id', connection.id).eq('lock_token', item.lock_token)
        await log({
          queueId: item.id,
          eventType: 'draft_failed',
          severity: 'error',
          attemptNumber: item.draft_attempts,
          message: 'Draft claim failed the server verification guard.',
          errorCode: 'unsafe_claim',
        })
        continue
      }

      const { data: currentBudget, error: currentBudgetError } = await admin
        .from('api_budget_state')
        .select('spent_usd, budget_usd')
        .eq('id', 'default')
        .maybeSingle<{ spent_usd: number; budget_usd: number }>()
      if (currentBudgetError || !currentBudget || currentBudget.spent_usd >= currentBudget.budget_usd) {
        failed += 1
        await admin.from('youtube_comment_queue').update({
          processing_state: 'queued_for_draft',
          draft_attempts: Math.max(0, item.draft_attempts - 1),
          next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          lock_token: null,
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
          last_error_stage: 'draft',
          last_error_code: currentBudgetError ? 'budget_check_failed' : 'budget_exhausted',
          last_error_message: currentBudgetError
            ? 'AI budget availability could not be verified.'
            : 'AI drafting is paused because the configured budget was reached.',
        }).eq('id', item.id).eq('connection_id', connection.id).eq('lock_token', item.lock_token)
        await log({
          queueId: item.id,
          eventType: 'draft_failed',
          severity: 'warning',
          attemptNumber: item.draft_attempts,
          message: currentBudgetError ? 'AI budget check failed; drafting was deferred.' : 'AI budget reached; drafting was deferred.',
          errorCode: currentBudgetError ? 'budget_check_failed' : 'budget_exhausted',
        })
        continue
      }

      await log({
        queueId: item.id,
        eventType: 'draft_started',
        attemptNumber: item.draft_attempts,
        message: 'YouTube comment classification and drafting started.',
      })

      try {
        const decision = await classifyAndGenerateYouTubeDraft({
          channelTitle: connection.channel_title ?? 'your YouTube channel',
          author: item.author_display_name ?? 'Viewer',
          commentText: item.comment_text,
          usageOperation,
        })

        const update = decision.shouldDraft
          ? {
              category: decision.category,
              category_confidence: decision.confidence,
              generated_reply: decision.reply,
              edited_reply: null,
              processing_state: 'awaiting_approval',
              approval_status: 'pending',
            }
          : {
              category: decision.category,
              category_confidence: decision.confidence,
              generated_reply: null,
              edited_reply: null,
              processing_state: 'skipped',
              approval_status: 'pending',
            }

        const { data: saved, error: saveError } = await admin
          .from('youtube_comment_queue')
          .update({
            ...update,
            next_attempt_at: null,
            lock_token: null,
            locked_by: null,
            locked_at: null,
            lease_expires_at: null,
            last_error_stage: null,
            last_error_code: null,
            last_error_message: null,
          })
          .eq('id', item.id)
          .eq('connection_id', connection.id)
          .eq('processing_state', 'generating')
          .eq('lock_token', item.lock_token)
          .select('id')
          .maybeSingle()
        if (saveError || !saved) throw new Error('draft_save_failed')

        if (decision.shouldDraft) drafted += 1
        else skipped += 1
        await log({
          queueId: item.id,
          eventType: 'draft_succeeded',
          attemptNumber: item.draft_attempts,
          message: decision.shouldDraft
            ? 'YouTube AI draft saved for manual approval.'
            : 'YouTube comment classified as spam and skipped.',
          metadata: { category: decision.category, confidence: decision.confidence, drafted: decision.shouldDraft },
        })
      } catch (error) {
        failed += 1
        const retryDelayMinutes = Math.min(60, 2 ** Math.max(1, item.draft_attempts))
        const exhausted = item.draft_attempts >= settings.max_draft_attempts
        await admin.from('youtube_comment_queue').update({
          processing_state: 'draft_failed',
          next_attempt_at: exhausted ? null : new Date(Date.now() + retryDelayMinutes * 60_000).toISOString(),
          lock_token: null,
          locked_by: null,
          locked_at: null,
          lease_expires_at: null,
          last_error_stage: 'draft',
          last_error_code: exhausted ? 'draft_attempts_exhausted' : 'generation_failed',
          last_error_message: exhausted
            ? 'AI drafting failed and the retry limit was reached.'
            : 'AI drafting failed and can be retried later.',
        }).eq('id', item.id).eq('connection_id', connection.id).eq('lock_token', item.lock_token)
        await log({
          queueId: item.id,
          eventType: 'draft_failed',
          severity: 'error',
          attemptNumber: item.draft_attempts,
          message: exhausted ? 'AI drafting retry limit reached.' : 'AI drafting failed.',
          errorCode: exhausted ? 'draft_attempts_exhausted' : 'generation_failed',
          metadata: { errorType: error instanceof Error ? error.name : 'UnknownError' },
        })
      }
    }

    return NextResponse.json({
      claimed: claimed.length,
      drafted,
      skipped,
      selfSkipped: selfSkipped ?? 0,
      failed,
      remainingHourly: Math.max(0, remainingHourly - claimed.length),
    })
  } finally {
    draftingInFlight.delete(userBucket)
  }
}
