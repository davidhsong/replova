import 'server-only'

import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getValidYouTubeAccessToken, type YouTubeConnectionTokenFields } from './youtubeAuth'
import {
  isYouTubeAutomationEnabled,
  nextYouTubeSyncCheckpoint,
  sanitizeYouTubeAutomationErrorCode,
} from './youtubeAutomationPolicy'
import { draftYouTubePendingComments, type YouTubeDraftRunSummary } from './youtubeDraftService'
import { syncYouTubeCommentsPage, type YouTubeSyncPageSummary } from './youtubeSyncService'

type RuntimeLease = {
  connection_id: string
  sync_page_token: string | null
  sync_cycle_started_at: string | null
  lease_token: string
}

type ConnectionRow = YouTubeConnectionTokenFields & {
  id: string
  channel_id: string
  channel_title: string | null
}

type SettingsRow = {
  automation_enabled: boolean
  max_comments_per_sync: number
  max_drafts_per_run: number
  max_draft_attempts: number
}

export type YouTubeAutomationConnectionResult = {
  connectionId: string
  status: 'completed' | 'partial' | 'reconnect_required' | 'disabled' | 'failed' | 'deferred'
  sync?: Omit<YouTubeSyncPageSummary, 'nextPageToken'> & { checkpointPending: boolean }
  drafts?: YouTubeDraftRunSummary
  errorCode?: string
}

export type YouTubeAutomationRunSummary = {
  runId: string
  claimed: number
  completed: number
  partial: number
  reconnectRequired: number
  failed: number
  deferred: number
  connections: YouTubeAutomationConnectionResult[]
}

async function logSync(admin: SupabaseClient, row: {
  connectionId: string
  runId: string
  eventType: 'sync_started' | 'sync_succeeded' | 'sync_failed'
  severity: 'info' | 'warning' | 'error'
  message: string
  errorCode?: string
  metadata?: Record<string, unknown>
}) {
  const { error } = await admin.from('youtube_automation_logs').insert({
    connection_id: row.connectionId,
    run_id: row.runId,
    event_type: row.eventType,
    severity: row.severity,
    message: row.message,
    error_code: row.errorCode ?? null,
    metadata: row.metadata ?? {},
  })
  if (error) console.error('[YouTube automation] Log write failed:', error.code)
}

async function finishLease(admin: SupabaseClient, row: {
  connectionId: string
  leaseToken: string
  runId: string
  drafted: boolean
  errorCode?: string
}) {
  const { error } = await admin.rpc('finish_youtube_automation_connection', {
    p_connection_id: row.connectionId,
    p_lease_token: row.leaseToken,
    p_run_id: row.runId,
    p_drafted: row.drafted,
    p_error_code: row.errorCode ?? null,
  })
  if (error) console.error('[YouTube automation] Lease release failed:', error.code)
}

export async function runYouTubeSyncAndDraftAutomation({
  admin,
  maxRuntimeMs = 45_000,
  connectionBatchSize = 10,
  workerId = `youtube-worker:${process.pid}`,
}: {
  admin: SupabaseClient
  maxRuntimeMs?: number
  connectionBatchSize?: number
  workerId?: string
}): Promise<YouTubeAutomationRunSummary> {
  const runId = randomUUID()
  const deadlineMs = Date.now() + Math.max(5_000, Math.min(maxRuntimeMs, 55_000))
  const workerSignal = AbortSignal.timeout(Math.max(1, deadlineMs - Date.now() - 2_000))
  const summary: YouTubeAutomationRunSummary = {
    runId,
    claimed: 0,
    completed: 0,
    partial: 0,
    reconnectRequired: 0,
    failed: 0,
    deferred: 0,
    connections: [],
  }

  const { data, error: claimError } = await admin.rpc('claim_youtube_automation_connections', {
    p_batch_size: Math.max(1, Math.min(connectionBatchSize, 100)),
    p_worker_id: workerId,
    p_lease_seconds: 120,
    p_run_id: runId,
  })
  if (claimError) throw new Error('automation_connection_claim_failed')

  const leases = (data ?? []) as RuntimeLease[]
  summary.claimed = leases.length

  for (let index = 0; index < leases.length; index += 1) {
    const lease = leases[index]
    if (Date.now() >= deadlineMs - 3_000) {
      for (const deferred of leases.slice(index)) {
        await finishLease(admin, {
          connectionId: deferred.connection_id,
          leaseToken: deferred.lease_token,
          runId,
          drafted: false,
          errorCode: 'worker_deadline',
        })
        summary.deferred += 1
        summary.connections.push({ connectionId: deferred.connection_id, status: 'deferred', errorCode: 'worker_deadline' })
      }
      break
    }

    const [{ data: connection, error: connectionError }, { data: settings, error: settingsError }] = await Promise.all([
      admin.from('youtube_connections')
        .select('id, user_id, channel_id, channel_title, access_token_encrypted, refresh_token_encrypted, token_expires_at')
        .eq('id', lease.connection_id)
        .maybeSingle<ConnectionRow>(),
      admin.from('youtube_automation_settings')
        .select('automation_enabled, max_comments_per_sync, max_drafts_per_run, max_draft_attempts')
        .eq('connection_id', lease.connection_id)
        .maybeSingle<SettingsRow>(),
    ])

    if (connectionError || settingsError || !connection || !settings) {
      await finishLease(admin, {
        connectionId: lease.connection_id,
        leaseToken: lease.lease_token,
        runId,
        drafted: false,
        errorCode: 'connection_context_unavailable',
      })
      summary.failed += 1
      summary.connections.push({ connectionId: lease.connection_id, status: 'failed', errorCode: 'connection_context_unavailable' })
      continue
    }
    if (!isYouTubeAutomationEnabled(settings)) {
      await finishLease(admin, {
        connectionId: connection.id,
        leaseToken: lease.lease_token,
        runId,
        drafted: false,
        errorCode: 'automation_disabled',
      })
      summary.connections.push({ connectionId: connection.id, status: 'disabled' })
      continue
    }

    await logSync(admin, {
      connectionId: connection.id,
      runId,
      eventType: 'sync_started',
      severity: 'info',
      message: 'Background YouTube sync-and-draft run started.',
      metadata: { checkpoint_resumed: Boolean(lease.sync_page_token) },
    })

    let accessToken: string | null
    try {
      accessToken = await getValidYouTubeAccessToken(connection, admin, {
        preserveConnectionOnRefreshFailure: true,
        signal: workerSignal,
      })
    } catch {
      await logSync(admin, {
        connectionId: connection.id,
        runId,
        eventType: 'sync_failed',
        severity: 'error',
        message: 'YouTube authorization refresh could not be completed.',
        errorCode: workerSignal.aborted ? 'worker_deadline' : 'authorization_refresh_failed',
      })
      await finishLease(admin, {
        connectionId: connection.id,
        leaseToken: lease.lease_token,
        runId,
        drafted: false,
        errorCode: workerSignal.aborted ? 'worker_deadline' : 'authorization_refresh_failed',
      })
      summary.deferred += workerSignal.aborted ? 1 : 0
      summary.failed += workerSignal.aborted ? 0 : 1
      summary.connections.push({
        connectionId: connection.id,
        status: workerSignal.aborted ? 'deferred' : 'failed',
        errorCode: workerSignal.aborted ? 'worker_deadline' : 'authorization_refresh_failed',
      })
      continue
    }
    if (!accessToken) {
      await logSync(admin, {
        connectionId: connection.id,
        runId,
        eventType: 'sync_failed',
        severity: 'error',
        message: 'YouTube authorization requires reconnection.',
        errorCode: 'authorization_reconnect_required',
      })
      await finishLease(admin, {
        connectionId: connection.id,
        leaseToken: lease.lease_token,
        runId,
        drafted: false,
        errorCode: 'authorization_reconnect_required',
      })
      summary.reconnectRequired += 1
      summary.connections.push({ connectionId: connection.id, status: 'reconnect_required', errorCode: 'authorization_reconnect_required' })
      continue
    }

    let syncSummary: YouTubeSyncPageSummary | null = null
    let draftSummary: YouTubeDraftRunSummary | undefined
    try {
      syncSummary = await syncYouTubeCommentsPage({
        admin,
        connectionId: connection.id,
        channelId: connection.channel_id,
        ownerUserId: connection.user_id,
        channelTitle: connection.channel_title,
        accessToken,
        pageToken: lease.sync_page_token ?? undefined,
        maxResults: settings.max_comments_per_sync,
        signal: workerSignal,
      })
      const checkpoint = nextYouTubeSyncCheckpoint({
        currentCycleStartedAt: lease.sync_cycle_started_at,
        nextPageToken: syncSummary.nextPageToken,
        now: new Date().toISOString(),
      })
      const { error: checkpointError } = await admin.rpc('checkpoint_youtube_automation_sync', {
        p_connection_id: connection.id,
        p_lease_token: lease.lease_token,
        p_run_id: runId,
        p_next_page_token: checkpoint.nextPageToken,
        p_cycle_started_at: checkpoint.cycleStartedAt,
        p_cycle_complete: checkpoint.cycleComplete,
      })
      if (checkpointError) throw new Error('sync_checkpoint_failed')

      await logSync(admin, {
        connectionId: connection.id,
        runId,
        eventType: syncSummary.partial ? 'sync_failed' : 'sync_succeeded',
        severity: syncSummary.partial ? 'warning' : 'info',
        message: syncSummary.partial
          ? 'Background YouTube sync completed with partial verification.'
          : 'Background YouTube sync page completed.',
        errorCode: syncSummary.partial ? 'partial_sync' : undefined,
        metadata: {
          fetched: syncSummary.fetched,
          inserted: syncSummary.inserted,
          updated: syncSummary.updated,
          published_detected: syncSummary.publishedDetected,
          verification_unknown: syncSummary.verificationUnknown,
          checkpoint_pending: !checkpoint.cycleComplete,
          video_context_unavailable: syncSummary.videoContextUnavailable,
        },
      })

      draftSummary = await draftYouTubePendingComments({
        admin,
        connection: {
          id: connection.id,
          userId: connection.user_id,
          channelId: connection.channel_id,
          channelTitle: connection.channel_title,
        },
        settings: {
          automationEnabled: settings.automation_enabled,
          maxDraftsPerRun: settings.max_drafts_per_run,
          maxDraftAttempts: settings.max_draft_attempts,
        },
        runId,
        workerId,
        requireAutomationEnabled: true,
        deadlineMs,
        signal: workerSignal,
      })

      const isPartial = syncSummary.partial
        || draftSummary.failed > 0
        || draftSummary.deferred > 0
        || draftSummary.rateLimited
        || draftSummary.budgetExhausted
      await finishLease(admin, {
        connectionId: connection.id,
        leaseToken: lease.lease_token,
        runId,
        drafted: draftSummary.drafted > 0,
        errorCode: isPartial ? 'partial_run' : undefined,
      })
      if (isPartial) summary.partial += 1
      else summary.completed += 1
      summary.connections.push({
        connectionId: connection.id,
        status: isPartial ? 'partial' : 'completed',
        sync: {
          fetched: syncSummary.fetched,
          inserted: syncSummary.inserted,
          updated: syncSummary.updated,
          publishedDetected: syncSummary.publishedDetected,
          verificationUnknown: syncSummary.verificationUnknown,
          publishedUpdateFailures: syncSummary.publishedUpdateFailures,
          partial: syncSummary.partial,
          videoContextUnavailable: syncSummary.videoContextUnavailable,
          checkpointPending: Boolean(syncSummary.nextPageToken),
        },
        drafts: draftSummary,
      })
    } catch (error) {
      const deadlineReached = workerSignal.aborted
      const errorCode = deadlineReached ? 'worker_deadline' : sanitizeYouTubeAutomationErrorCode(error)
      let staleCheckpointReset = false
      if (!syncSummary && errorCode === 'invalidPageToken') {
        const { error: resetError } = await admin.rpc('checkpoint_youtube_automation_sync', {
          p_connection_id: connection.id,
          p_lease_token: lease.lease_token,
          p_run_id: runId,
          p_next_page_token: null,
          p_cycle_started_at: null,
          p_cycle_complete: true,
        })
        staleCheckpointReset = !resetError
      }
      await logSync(admin, {
        connectionId: connection.id,
        runId,
        eventType: 'sync_failed',
        severity: deadlineReached ? 'warning' : 'error',
        message: deadlineReached
          ? 'Background YouTube sync-and-draft run reached its execution deadline.'
          : 'Background YouTube sync-and-draft run failed.',
        errorCode,
        metadata: {
          sync_completed: Boolean(syncSummary),
          drafting_started: Boolean(draftSummary),
          stale_checkpoint_reset: staleCheckpointReset,
        },
      })
      await finishLease(admin, {
        connectionId: connection.id,
        leaseToken: lease.lease_token,
        runId,
        drafted: false,
        errorCode,
      })
      if (deadlineReached) summary.deferred += 1
      else summary.failed += 1
      summary.connections.push({
        connectionId: connection.id,
        status: deadlineReached ? 'deferred' : 'failed',
        errorCode,
      })
    }
  }

  return summary
}
