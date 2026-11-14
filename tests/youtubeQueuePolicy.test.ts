import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  canManuallyPublishYouTubeQueueItem,
  canUseYouTubeQueueAction,
  isYouTubeQueueFilter,
  sanitizeYouTubeQueueDraft,
} from '../lib/youtubeQueuePolicy'

const reviewItem = {
  processingState: 'awaiting_approval',
  approvalStatus: 'pending',
  replyVerificationStatus: 'verified_unpublished',
  publishedReplyId: null,
}

test('queue filters accept only supported server values', () => {
  for (const filter of ['needs_review', 'approved', 'published', 'skipped', 'failed']) {
    assert.equal(isYouTubeQueueFilter(filter), true)
  }
  assert.equal(isYouTubeQueueFilter('all'), false)
})

test('manual drafts are trimmed, bounded, and stripped of unsafe control characters', () => {
  assert.equal(sanitizeYouTubeQueueDraft('  A\u0000 saved reply.  '), 'A saved reply.')
  assert.equal(sanitizeYouTubeQueueDraft('   '), null)
  assert.equal(sanitizeYouTubeQueueDraft('a'.repeat(1001)), null)
  assert.equal(sanitizeYouTubeQueueDraft({}), null)
})

test('published and uncertain replies cannot be edited, approved, or regenerated', () => {
  for (const action of ['save', 'approve', 'reject', 'begin_regenerate'] as const) {
    assert.equal(canUseYouTubeQueueAction({ ...reviewItem, processingState: 'published' }, action), false)
    assert.equal(canUseYouTubeQueueAction({ ...reviewItem, processingState: 'publish_uncertain' }, action), false)
    assert.equal(canUseYouTubeQueueAction({ ...reviewItem, publishedReplyId: 'reply-id' }, action), false)
  }
})

test('approval and regeneration require verified-unpublished state', () => {
  assert.equal(canUseYouTubeQueueAction(reviewItem, 'approve'), true)
  assert.equal(canUseYouTubeQueueAction(reviewItem, 'begin_regenerate'), true)
  assert.equal(canUseYouTubeQueueAction({ ...reviewItem, replyVerificationStatus: 'unknown' }, 'approve'), false)
  assert.equal(canUseYouTubeQueueAction({ ...reviewItem, replyVerificationStatus: 'unknown' }, 'begin_regenerate'), false)
})

test('manual publishing requires a durable approved and verified draft', () => {
  const approved = {
    processingState: 'ready_to_publish',
    approvalStatus: 'approved',
    replyVerificationStatus: 'verified_unpublished',
    publishedReplyId: null,
    publishResultUncertain: false,
    draft: 'Saved reply',
  }

  assert.equal(canManuallyPublishYouTubeQueueItem(approved), true)
  assert.equal(canManuallyPublishYouTubeQueueItem({ ...approved, processingState: 'publish_failed' }), true)
  assert.equal(canManuallyPublishYouTubeQueueItem({ ...approved, processingState: 'publishing' }), false)
  assert.equal(canManuallyPublishYouTubeQueueItem({ ...approved, replyVerificationStatus: 'unknown' }), false)
  assert.equal(canManuallyPublishYouTubeQueueItem({ ...approved, publishResultUncertain: true }), false)
  assert.equal(canManuallyPublishYouTubeQueueItem({ ...approved, draft: '   ' }), false)
})

test('migration 022 provides atomic manual claims and non-retryable uncertain results', async () => {
  const sql = await readFile(new URL('../supabase/migrations/022_youtube_manual_publish.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION claim_youtube_manual_publish/)
  assert.match(sql, /processing_state NOT IN \('ready_to_publish', 'publish_failed'\)/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /idempotency_key/)
  assert.match(sql, /processing_state = CASE WHEN p_uncertain THEN 'publish_uncertain' ELSE 'publish_failed' END/)
  assert.match(sql, /'automatic_retry_allowed', false/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION claim_youtube_manual_publish[\s\S]+TO service_role/)
})

test('migration makes queue transitions and audit logs transactional', async () => {
  const sql = await readFile(new URL('../supabase/migrations/021_youtube_reply_queue_transitions.sql', import.meta.url), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION transition_youtube_reply_queue_item/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION finish_youtube_reply_regeneration/)
  assert.match(sql, /CREATE OR REPLACE FUNCTION fail_youtube_reply_regeneration/)
  assert.match(sql, /'draft_edited'/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /GRANT EXECUTE ON FUNCTION transition_youtube_reply_queue_item[\s\S]+TO service_role/)
})
