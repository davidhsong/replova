import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  isClaimedYouTubeDraftSafe,
  normalizeYouTubeDraftDecision,
} from '../lib/youtubeDraftingPolicy'

test('only a verified-unpublished non-self claimed comment is safe to draft', () => {
  const base = {
    processingState: 'generating',
    replyVerificationStatus: 'verified_unpublished',
    authorChannelId: 'viewer-channel',
    connectedChannelId: 'owner-channel',
  }

  assert.equal(isClaimedYouTubeDraftSafe(base), true)
  assert.equal(isClaimedYouTubeDraftSafe({ ...base, replyVerificationStatus: 'unknown' }), false)
  assert.equal(isClaimedYouTubeDraftSafe({ ...base, replyVerificationStatus: 'verified_published' }), false)
  assert.equal(isClaimedYouTubeDraftSafe({ ...base, authorChannelId: 'owner-channel' }), false)
  assert.equal(isClaimedYouTubeDraftSafe({ ...base, authorChannelId: null }), false)
  assert.equal(isClaimedYouTubeDraftSafe({ ...base, processingState: 'discovered' }), false)
})

test('spam is classified without retaining a draft', () => {
  assert.deepEqual(normalizeYouTubeDraftDecision({
    category: 'spam',
    confidence: 0.9876,
    reply: 'This should be discarded.',
  }), {
    category: 'spam',
    confidence: 0.988,
    shouldDraft: false,
    reply: null,
    requiresManualReview: false,
    manualReviewReason: null,
  })
})

test('questions and complaints remain eligible for a draft', () => {
  for (const category of ['question', 'complaint'] as const) {
    const decision = normalizeYouTubeDraftDecision({
      category,
      confidence: 0.9,
      reply: '  A grounded response.  ',
    })
    assert.equal(decision.shouldDraft, true)
    assert.equal(decision.reply, 'A grounded response.')
  }
})

test('invalid categories and confidence values are rejected', () => {
  assert.throws(() => normalizeYouTubeDraftDecision({
    category: 'self',
    confidence: 1,
    reply: '',
  }))
  assert.throws(() => normalizeYouTubeDraftDecision({
    category: 'question',
    confidence: 1.1,
    reply: 'Reply',
  }))
})

test('migration hardens both draft and publish claims with verification and self-comment guards', async () => {
  const sql = await readFile(new URL('../supabase/migrations/020_youtube_draft_claim_safety.sql', import.meta.url), 'utf8')
  const verificationGuards = sql.match(/reply_verification_status = 'verified_unpublished'/g) ?? []
  const selfGuards = sql.match(/author_channel_id <> connection\.channel_id/g) ?? []

  assert.equal(verificationGuards.length, 2)
  assert.equal(selfGuards.length, 2)
  assert.match(sql, /FOR UPDATE OF queue SKIP LOCKED/)
  assert.match(sql, /settings\.max_drafts_per_run/)
})
