import 'server-only'

import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { classifyAndGenerateYouTubeDraft } from './generateYouTubeReply'
import { getYouTubeDraftCapacity } from './youtubeAutomationPolicy'
import { isClaimedYouTubeDraftSafe } from './youtubeDraftingPolicy'
import { selectRelevantReplyKnowledge } from './replyKnowledge'
import { loadYouTubeReplyKnowledge } from './youtubeKnowledge'

const HOURLY_DRAFT_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000

type ClaimedRow = {
  id: string
  author_channel_id: string | null
  author_display_name: string | null
  comment_text: string
  video_id: string
  processing_state: string
  reply_verification_status: string
  draft_attempts: number
  lock_token: string | null
}

export type YouTubeDraftRunSummary = {
  claimed: number
  drafted: number
  skipped: number
  selfSkipped: number
  failed: number
  deferred: number
  rateLimited: boolean
  budgetExhausted: boolean
}

async function writeDraftLog(admin: SupabaseClient, row: {
  connectionId: string
  runId: string
  queueId?: string
  eventType: 'draft_started' | 'draft_succeeded' | 'draft_failed'
  severity?: 'info' | 'warning' | 'error'
  attemptNumber?: number
  message: string
  errorCode?: string
  metadata?: Record<string, unknown>
}) {
  const { error } = await admin.from('youtube_automation_logs').insert({
    connection_id: row.connectionId,
    queue_id: row.queueId ?? null,
    run_id: row.runId,
    event_type: row.eventType,
    severity: row.severity ?? 'info',
    attempt_number: row.attemptNumber ?? null,
    message: row.message,
    error_code: row.errorCode ?? null,
    metadata: row.metadata ?? {},
  })
  if (error) console.error('[YouTube drafting] Log write failed:', error.code)
}

async function releaseClaim(admin: SupabaseClient, connectionId: string, item: ClaimedRow, options: {
  code: string
  message: string
  retryAt?: string | null
  decrementAttempt?: boolean
}) {
  if (!item.lock_token) return
  await admin.from('youtube_comment_queue').update({
    processing_state: 'queued_for_draft',
    ...(options.decrementAttempt ? { draft_attempts: Math.max(0, item.draft_attempts - 1) } : {}),
    next_attempt_at: options.retryAt ?? null,
    lock_token: null,
    locked_by: null,
    locked_at: null,
    lease_expires_at: null,
    last_error_stage: 'draft',
    last_error_code: options.code,
    last_error_message: options.message,
  }).eq('id', item.id).eq('connection_id', connectionId).eq('lock_token', item.lock_token)
}

export async function draftYouTubePendingComments({
  admin,
  connection,
  settings,
  runId,
  workerId,
  requireAutomationEnabled,
  deadlineMs,
  signal,
}: {
  admin: SupabaseClient
  connection: { id: string; userId: string; channelId: string; channelTitle: string | null }
  settings: { automationEnabled: boolean; maxDraftsPerRun: number; maxDraftAttempts: number }
  runId: string
  workerId: string
  requireAutomationEnabled: boolean
  deadlineMs: number
  signal?: AbortSignal
}): Promise<YouTubeDraftRunSummary> {
  const summary: YouTubeDraftRunSummary = {
    claimed: 0,
    drafted: 0,
    skipped: 0,
    selfSkipped: 0,
    failed: 0,
    deferred: 0,
    rateLimited: false,
    budgetExhausted: false,
  }
  if (requireAutomationEnabled && !settings.automationEnabled) return summary

  const userBucket = createHash('sha256').update(connection.userId).digest('hex').slice(0, 20)
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
  if (usageError || budgetError || !budget) throw new Error('ai_budget_lookup_failed')
  const capacity = getYouTubeDraftCapacity({
    hourlyUsage: count ?? 0,
    hourlyLimit: HOURLY_DRAFT_LIMIT,
    spentUsd: budget.spent_usd,
    budgetUsd: budget.budget_usd,
    configuredBatchSize: settings.maxDraftsPerRun,
  })
  if (capacity.budgetExhausted) {
    summary.budgetExhausted = true
    return summary
  }
  if (capacity.rateLimited) {
    summary.rateLimited = true
    return summary
  }

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
    .eq('author_channel_id', connection.channelId)
    .in('processing_state', ['discovered', 'queued_for_draft', 'draft_failed'])
  if (selfSkipError) console.error('[YouTube drafting] Self-comment update failed:', selfSkipError.code)
  summary.selfSkipped = selfSkipped ?? 0

  const knowledge = await loadYouTubeReplyKnowledge(admin, {
    id: connection.id,
    userId: connection.userId,
    channelId: connection.channelId,
    channelTitle: connection.channelTitle,
  })

  const { data, error: claimError } = await admin.rpc('claim_youtube_draft_items', {
    batch_size: capacity.batchSize,
    worker_id: workerId,
    lease_minutes: 15,
    connection_filter: connection.id,
    require_automation_enabled: requireAutomationEnabled,
  })
  if (claimError) throw new Error('draft_claim_failed')

  const claimed = (data ?? []) as ClaimedRow[]
  summary.claimed = claimed.length

  for (let index = 0; index < claimed.length; index += 1) {
    const item = claimed[index]
    if (Date.now() >= deadlineMs - 2_000) {
      for (const deferred of claimed.slice(index)) {
        await releaseClaim(admin, connection.id, deferred, {
          code: 'worker_deadline',
          message: 'Drafting was deferred to the next worker run.',
          decrementAttempt: true,
        })
        summary.deferred += 1
      }
      break
    }

    if (!item.lock_token || !isClaimedYouTubeDraftSafe({
      processingState: item.processing_state,
      replyVerificationStatus: item.reply_verification_status,
      authorChannelId: item.author_channel_id,
      connectedChannelId: connection.channelId,
    })) {
      summary.failed += 1
      await releaseClaim(admin, connection.id, item, {
        code: 'unsafe_claim',
        message: 'Draft claim failed the server verification guard.',
      })
      await writeDraftLog(admin, {
        connectionId: connection.id,
        runId,
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
      summary.budgetExhausted = !currentBudgetError
      for (const deferred of claimed.slice(index)) {
        await releaseClaim(admin, connection.id, deferred, {
          code: currentBudgetError ? 'budget_check_failed' : 'budget_exhausted',
          message: currentBudgetError
            ? 'AI budget availability could not be verified.'
            : 'AI drafting is paused because the configured budget was reached.',
          retryAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          decrementAttempt: true,
        })
        summary.deferred += 1
      }
      break
    }

    await writeDraftLog(admin, {
      connectionId: connection.id,
      runId,
      queueId: item.id,
      eventType: 'draft_started',
      attemptNumber: item.draft_attempts,
      message: 'YouTube comment classification and drafting started.',
    })

    try {
      const knowledgeContext = selectRelevantReplyKnowledge({
        knowledge,
        commentText: item.comment_text,
        videoId: item.video_id,
      })
      const decision = await classifyAndGenerateYouTubeDraft({
        channelTitle: connection.channelTitle ?? 'your YouTube channel',
        author: item.author_display_name ?? 'Viewer',
        commentText: item.comment_text,
        usageOperation,
        signal,
        knowledgeContext,
      })
      const update = decision.shouldDraft
        ? {
            category: decision.category,
            category_confidence: decision.confidence,
            generated_reply: decision.reply,
            edited_reply: null,
            processing_state: 'awaiting_approval',
            approval_status: 'pending',
            requires_manual_review: decision.requiresManualReview,
            manual_review_reason: decision.manualReviewReason,
            knowledge_entry_ids: knowledgeContext.entryIds,
            knowledge_context_used_at: new Date().toISOString(),
          }
        : {
            category: decision.category,
            category_confidence: decision.confidence,
            generated_reply: null,
            edited_reply: null,
            processing_state: 'skipped',
            approval_status: 'pending',
            requires_manual_review: false,
            manual_review_reason: null,
            knowledge_entry_ids: [],
            knowledge_context_used_at: null,
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

      if (decision.shouldDraft) summary.drafted += 1
      else summary.skipped += 1
      await writeDraftLog(admin, {
        connectionId: connection.id,
        runId,
        queueId: item.id,
        eventType: 'draft_succeeded',
        attemptNumber: item.draft_attempts,
        message: decision.shouldDraft
          ? 'YouTube AI draft saved for manual approval.'
          : 'YouTube comment classified as spam and skipped.',
        metadata: {
          category: decision.category,
          confidence: decision.confidence,
          drafted: decision.shouldDraft,
          requires_manual_review: decision.requiresManualReview,
          knowledge_entry_count: knowledgeContext.entryIds.length,
        },
      })
    } catch (error) {
      if (signal?.aborted) {
        for (const deferred of claimed.slice(index)) {
          await releaseClaim(admin, connection.id, deferred, {
            code: 'worker_deadline',
            message: 'Drafting was deferred to the next worker run.',
            decrementAttempt: true,
          })
          summary.deferred += 1
        }
        break
      }
      summary.failed += 1
      const exhausted = item.draft_attempts >= settings.maxDraftAttempts
      const retryDelayMinutes = Math.min(60, 2 ** Math.max(1, item.draft_attempts))
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
      await writeDraftLog(admin, {
        connectionId: connection.id,
        runId,
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

  return summary
}
