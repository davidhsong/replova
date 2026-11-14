import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildYouTubeSyncQueueRow,
  getYouTubeDraftCapacity,
  isYouTubeAutomationEnabled,
  nextYouTubeSyncCheckpoint,
} from '../lib/youtubeAutomationPolicy'
import { handleYouTubeAutomationRequest } from '../lib/youtubeAutomationEndpoint'
import {
  encryptYouTubeToken,
  getValidYouTubeAccessToken,
} from '../lib/youtubeAuth'

test('automation endpoint rejects missing and invalid bearer credentials before running', async () => {
  let runCalls = 0
  const run = async () => {
    runCalls += 1
    return { status: 200, body: { ok: true } }
  }

  for (const authorization of [null, 'Bearer wrong', 'Basic configured-secret']) {
    const headers = authorization ? { authorization } : undefined
    const response = await handleYouTubeAutomationRequest(
      new Request('http://localhost/api/youtube/automation/run', { method: 'POST', headers }),
      { configuredSecret: 'configured-secret', run }
    )
    assert.equal(response.status, 401)
  }

  assert.equal(runCalls, 0)
})

test('automation endpoint does not process when its server secret is unconfigured', async () => {
  let runCalls = 0
  const response = await handleYouTubeAutomationRequest(
    new Request('http://localhost/api/youtube/automation/run', {
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
    }),
    {
      configuredSecret: undefined,
      run: async () => {
        runCalls += 1
        return { status: 200, body: { ok: true } }
      },
    }
  )

  assert.equal(response.status, 503)
  assert.equal(runCalls, 0)
})

test('disabled automation is never eligible for background processing', () => {
  assert.equal(isYouTubeAutomationEnabled({ automation_enabled: true }), true)
  assert.equal(isYouTubeAutomationEnabled({ automation_enabled: false }), false)
  assert.equal(isYouTubeAutomationEnabled(null), false)
})

test('incremental pagination keeps and then clears a durable checkpoint', () => {
  const startedAt = '2026-11-14T10:00:00.000Z'
  assert.deepEqual(nextYouTubeSyncCheckpoint({
    currentCycleStartedAt: null,
    nextPageToken: 'next-page',
    now: startedAt,
  }), {
    nextPageToken: 'next-page',
    cycleStartedAt: startedAt,
    cycleComplete: false,
  })

  assert.deepEqual(nextYouTubeSyncCheckpoint({
    currentCycleStartedAt: startedAt,
    nextPageToken: null,
    now: '2026-11-14T10:05:00.000Z',
  }), {
    nextPageToken: null,
    cycleStartedAt: null,
    cycleComplete: true,
  })
})

test('budget and hourly exhaustion produce zero AI draft capacity', () => {
  assert.deepEqual(getYouTubeDraftCapacity({
    hourlyUsage: 2,
    hourlyLimit: 10,
    spentUsd: 25,
    budgetUsd: 25,
    configuredBatchSize: 20,
  }), {
    budgetExhausted: true,
    rateLimited: false,
    remainingHourly: 8,
    batchSize: 0,
  })

  assert.equal(getYouTubeDraftCapacity({
    hourlyUsage: 10,
    hourlyLimit: 10,
    spentUsd: 1,
    budgetUsd: 25,
    configuredBatchSize: 20,
  }).batchSize, 0)
})

test('sync upserts omit draft and approval fields so saved work survives', () => {
  const row = buildYouTubeSyncQueueRow({
    connectionId: 'connection-id',
    checkedAt: '2026-11-14T10:00:00.000Z',
    current: {
      processing_state: 'awaiting_approval',
      reply_verification_checked_at: null,
      reply_verification_error: null,
    },
    comment: {
      id: 'comment-id',
      threadId: 'thread-id',
      videoId: 'video-id',
      authorChannelId: 'viewer-id',
      author: 'Viewer',
      text: 'A test comment',
      date: '2026-11-14T09:00:00.000Z',
      updatedAt: null,
      replyCount: 0,
      replyStatus: { status: 'not_published' },
    },
  })

  assert.equal('generated_reply' in row, false)
  assert.equal('edited_reply' in row, false)
  assert.equal('approval_status' in row, false)
  assert.equal('processing_state' in row, false)
})

test('revoked authorization in worker mode does not delete the connection', async () => {
  const originalKey = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  const originalClientId = process.env.GOOGLE_CLIENT_ID
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET
  const originalFetch = globalThis.fetch
  const databaseCalls: string[] = []

  process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })

  try {
    const admin = {
      from(table: string) {
        databaseCalls.push(table)
        throw new Error('No database mutation should occur for a rejected refresh')
      },
    } as unknown as SupabaseClient
    const token = await getValidYouTubeAccessToken({
      user_id: 'user-id',
      access_token_encrypted: encryptYouTubeToken('expired-access-token'),
      refresh_token_encrypted: encryptYouTubeToken('revoked-refresh-token'),
      token_expires_at: 0,
    }, admin, { preserveConnectionOnRefreshFailure: true })

    assert.equal(token, null)
    assert.deepEqual(databaseCalls, [])
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
    else process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = originalKey
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalClientId
    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret
  }
})

test('migration uses durable non-overlapping leases and enabled-only claims', async () => {
  const sql = await readFile(new URL('../supabase/migrations/023_youtube_automation_runtime.sql', import.meta.url), 'utf8')
  assert.match(sql, /settings\.automation_enabled = true/g)
  assert.match(sql, /FOR UPDATE OF runtime SKIP LOCKED/)
  assert.match(sql, /runtime\.lease_expires_at < now\(\)/)
  assert.match(sql, /checkpoint_youtube_automation_sync/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION claim_youtube_automation_connections[\s\S]+TO service_role/)
})

test('Phase 4A worker contains no publishing path', async () => {
  const sources = await Promise.all([
    '../lib/youtubeAutomationWorker.ts',
    '../lib/youtubeDraftService.ts',
    '../lib/youtubeSyncService.ts',
    '../app/api/youtube/automation/run/route.ts',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  const implementation = sources.join('\n')

  assert.doesNotMatch(implementation, /claim_youtube_publish/i)
  assert.doesNotMatch(implementation, /comments\.insert/i)
  assert.doesNotMatch(implementation, /youtubePublishing/)
  assert.doesNotMatch(implementation, /auto_publish_(enabled|authorized|revoked)/)
})
