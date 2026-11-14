import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  DEFAULT_YOUTUBE_CATEGORY_RULES,
  evaluateYouTubeAutoPublishEligibility,
  parseYouTubeCategoryRules,
} from '../lib/youtubeAutoPublishPolicy'

function eligible(overrides: Partial<Parameters<typeof evaluateYouTubeAutoPublishEligibility>[0]> = {}) {
  return evaluateYouTubeAutoPublishEligibility({
    mode: 'auto_publish',
    emergencyPaused: false,
    consentCurrent: true,
    categoryRules: DEFAULT_YOUTUBE_CATEGORY_RULES,
    minConfidence: 0.9,
    replyDelayMinutes: 2,
    commenterCooldownHours: 24,
    videoFilterMode: 'all',
    eligibleVideoIds: [],
    maxDailyPublishes: 5,
    dailyPublishCount: 0,
    category: 'praise',
    confidence: 0.98,
    commentText: 'This explanation was clear and useful.',
    commentPublishedAt: '2026-01-01T00:00:00.000Z',
    videoId: 'video-a',
    authorChannelId: 'viewer-a',
    connectedChannelId: 'owner-channel',
    replyVerificationStatus: 'verified_unpublished',
    requiresManualReview: false,
    publishedReplyId: null,
    processingState: 'awaiting_approval',
    publishResultUncertain: false,
    lastPublishedToCommenterAt: null,
    now: '2026-01-02T12:00:00.000Z',
    ...overrides,
  })
}

test('safe praise can satisfy a consented custom policy without enabling runtime publishing', () => {
  assert.deepEqual(eligible(), {
    decision: 'auto_publish', reason: 'eligible', category: 'praise', eligibleAt: null,
  })
  assert.equal(eligible({ mode: 'manual_approval' }).decision, 'manual_review')
  assert.equal(eligible({ consentCurrent: false }).reason, 'consent_required')
  assert.equal(eligible({ emergencyPaused: true }).reason, 'emergency_paused')
})

test('category rules are deterministic and high-risk categories default to review', () => {
  for (const category of ['question', 'complaint', 'negative_feedback', 'other'] as const) {
    assert.equal(eligible({ category }).decision, 'manual_review', category)
  }
  const custom = { ...DEFAULT_YOUTUBE_CATEGORY_RULES, neutral_feedback: 'skip' as const }
  assert.equal(eligible({ category: 'neutral_feedback', categoryRules: custom }).decision, 'skip')
  assert.equal(parseYouTubeCategoryRules({ ...custom, spam: 'auto_publish' }), null)
})

test('hard safety signals override an auto-publish category rule', () => {
  assert.equal(eligible({ category: 'spam' }).decision, 'skip')
  assert.equal(eligible({ authorChannelId: 'owner-channel' }).reason, 'self_comment')
  assert.equal(eligible({ replyVerificationStatus: 'verified_published' }).reason, 'already_answered')
  assert.equal(eligible({ publishedReplyId: 'reply-1' }).reason, 'already_answered')
  assert.equal(eligible({ replyVerificationStatus: 'unknown' }).reason, 'reply_status_unverified')
  assert.equal(eligible({ publishResultUncertain: true }).reason, 'publish_status_uncertain')
  assert.equal(eligible({ requiresManualReview: true }).reason, 'factual_grounding_required')
  assert.equal(eligible({ commentText: 'Call me at 555-123-4567.' }).reason, 'sensitive_content')
  assert.equal(eligible({ confidence: 0.89 }).reason, 'classification_confidence_low')
  assert.equal(eligible({ category: null }).reason, 'classification_ambiguous')
})

test('video filters, delay, cooldown, and daily limits are enforced', () => {
  assert.equal(eligible({ videoFilterMode: 'include', eligibleVideoIds: ['video-b'] }).reason, 'video_not_included')
  assert.equal(eligible({ videoFilterMode: 'exclude', eligibleVideoIds: ['video-a'] }).reason, 'video_excluded')
  assert.equal(eligible({ dailyPublishCount: 5 }).reason, 'daily_limit_reached')
  assert.deepEqual(eligible({
    commentPublishedAt: '2026-01-02T11:59:00.000Z',
  }), {
    decision: 'defer', reason: 'reply_delay', category: 'praise', eligibleAt: '2026-01-02T12:01:00.000Z',
  })
  assert.equal(eligible({ lastPublishedToCommenterAt: '2026-01-02T00:00:00.000Z' }).reason, 'commenter_cooldown')
})

test('migration requires scoped owner consent and keeps unattended publishing inaccessible', async () => {
  const sql = await readFile(new URL('../supabase/migrations/025_youtube_auto_publish_controls.sql', import.meta.url), 'utf8')
  assert.match(sql, /publishing_mode text NOT NULL DEFAULT 'manual_approval'/)
  assert.match(sql, /auto_publish_enabled = false/)
  assert.match(sql, /auto_publish_authorized_by <> connection_owner/)
  assert.match(sql, /auto_publish_consent_scope_hash IS DISTINCT FROM current_scope_hash/)
  assert.match(sql, /OLD\.auto_publish_revoked_at IS NULL[\s\S]+NEW\.auto_publish_revoked_at := now\(\)/)
  assert.match(sql, /youtube_connection_owner_mismatch/)
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION claim_youtube_publish_items\(integer, text, integer\) FROM service_role/)
  assert.doesNotMatch(sql, /comments\.insert|youtube\.googleapis\.com/)
})

test('scope hash uses built-in SHA-256 over the unchanged canonical policy and still invalidates consent', async () => {
  const sql = await readFile(new URL('../supabase/migrations/025_youtube_auto_publish_controls.sql', import.meta.url), 'utf8')
  const hashFunction = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION youtube_auto_publish_scope_hash('),
    sql.indexOf('CREATE OR REPLACE FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change()')
  )
  assert.match(hashFunction, /pg_catalog\.encode\(\s*pg_catalog\.sha256\(\s*convert_to\(/)
  assert.match(hashFunction, /'hex'/)
  assert.doesNotMatch(hashFunction, /\bdigest\s*\(/)
  for (const canonicalField of [
    'category_rules', 'max_daily', 'min_confidence', 'delay_minutes',
    'cooldown_hours', 'video_filter_mode', 'video_ids',
  ]) {
    assert.match(hashFunction, new RegExp(`'${canonicalField}'`), canonicalField)
  }
  assert.match(hashFunction, /ARRAY\(SELECT value FROM unnest\(p_video_ids\) AS value ORDER BY value\)/)
  assert.match(sql, /auto_publish_consent_scope_hash ~ '\^\[0-9a-f\]\{64\}\$'/)

  const invalidation = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION invalidate_youtube_auto_publish_consent_on_scope_change()'),
    sql.indexOf('CREATE OR REPLACE FUNCTION validate_youtube_auto_publish_consent()')
  )
  assert.equal((invalidation.match(/youtube_auto_publish_scope_hash\(/g) ?? []).length, 2)
  assert.match(invalidation, /old_hash IS DISTINCT FROM new_hash/)
  assert.match(invalidation, /NEW\.auto_publish_enabled := false/)
  assert.match(invalidation, /NEW\.publishing_mode := 'manual_approval'/)
  assert.match(invalidation, /NEW\.auto_publish_revoked_at := now\(\)/)
})

test('control APIs require session ownership, same-origin mutations, and explicit disclosures', async () => {
  const [access, policy, consent, pause] = await Promise.all([
    readFile(new URL('../lib/youtubeAutomationControls.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/automation/policy/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/automation/consent/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../app/api/youtube/automation/pause/route.ts', import.meta.url), 'utf8'),
  ])
  assert.match(access, /supabase\.auth\.getUser\(\)/)
  assert.match(access, /\.eq\('user_id', user\.id\)/)
  assert.match(access, /request\.headers\.get\('origin'\) === request\.nextUrl\.origin/)
  assert.match(access, /MUTATION_LIMIT/)
  assert.match(policy, /p_owner_id: access\.userId/)
  assert.match(consent, /publishesPublicReplies !== true/)
  assert.match(consent, /usesSavedRules !== true/)
  assert.match(consent, /canPauseOrRevoke !== true/)
  assert.match(pause, /set_youtube_automation_emergency_pause/)
  assert.match(`${policy}${consent}${pause}`, /runtimeEnabled: false/)
})
