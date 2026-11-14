import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_YOUTUBE_CATEGORY_RULES,
  evaluateYouTubeAutoPublishEligibility,
  parseYouTubeCategoryRules,
  type YouTubePublishingMode,
  type YouTubeVideoFilterMode,
} from '@/lib/youtubeAutoPublishPolicy'
import { getYouTubeAutomationAccess } from '@/lib/youtubeAutomationControls'

type QueueRow = {
  id: string
  video_id: string
  author_channel_id: string | null
  comment_text: string
  comment_published_at: string
  category: string | null
  category_confidence: number | null
  processing_state: string
  published_reply_id: string | null
  publish_result_uncertain: boolean
  reply_verification_status: string
  requires_manual_review: boolean
}

type SettingsRow = {
  publishing_mode: YouTubePublishingMode
  emergency_paused: boolean
  category_rules: Record<string, unknown>
  max_auto_publishes_per_day: number
  min_auto_publish_confidence: number
  reply_delay_minutes: number
  commenter_cooldown_hours: number
  eligible_video_filter_mode: YouTubeVideoFilterMode
  eligible_video_ids: string[]
  auto_publish_authorized_at: string | null
  auto_publish_consent_version: string | null
  auto_publish_consent_scope_hash: string | null
  auto_publish_revoked_at: string | null
}

export async function GET(request: NextRequest) {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  const queueId = request.nextUrl.searchParams.get('queueId')
  if (!queueId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(queueId)) {
    return NextResponse.json({ error: 'A valid queue item is required.' }, { status: 400 })
  }

  const [{ data: queue, error: queueError }, { data: settings, error: settingsError }] = await Promise.all([
    access.admin.from('youtube_comment_queue')
      .select('id, video_id, author_channel_id, comment_text, comment_published_at, category, category_confidence, processing_state, published_reply_id, publish_result_uncertain, reply_verification_status, requires_manual_review')
      .eq('id', queueId).eq('connection_id', access.connection.id).maybeSingle<QueueRow>(),
    access.admin.from('youtube_automation_settings')
      .select('publishing_mode, emergency_paused, category_rules, max_auto_publishes_per_day, min_auto_publish_confidence, reply_delay_minutes, commenter_cooldown_hours, eligible_video_filter_mode, eligible_video_ids, auto_publish_authorized_at, auto_publish_consent_version, auto_publish_consent_scope_hash, auto_publish_revoked_at')
      .eq('connection_id', access.connection.id).maybeSingle<SettingsRow>(),
  ])
  if (queueError || settingsError) {
    console.error('[YouTube automation eligibility] Lookup failed:', queueError?.code ?? settingsError?.code)
    return NextResponse.json({ error: 'Unable to evaluate this comment.' }, { status: 500 })
  }
  if (!queue || !settings) return NextResponse.json({ error: 'Queue item or settings not found.' }, { status: 404 })

  const today = new Date().toISOString().slice(0, 10)
  const dailyPromise = access.admin.from('youtube_auto_publish_daily_usage')
    .select('reserved_count').eq('connection_id', access.connection.id)
    .eq('usage_date', today).maybeSingle<{ reserved_count: number }>()
  const lastReplyPromise = queue.author_channel_id
    ? access.admin.from('youtube_comment_queue').select('published_at')
      .eq('connection_id', access.connection.id)
      .eq('author_channel_id', queue.author_channel_id)
      .eq('processing_state', 'published').not('published_at', 'is', null)
      .order('published_at', { ascending: false }).limit(1).maybeSingle<{ published_at: string }>()
    : Promise.resolve({ data: null, error: null })
  const scopeHashPromise = access.admin.rpc('youtube_auto_publish_scope_hash', {
    p_category_rules: settings.category_rules,
    p_max_daily: settings.max_auto_publishes_per_day,
    p_min_confidence: settings.min_auto_publish_confidence,
    p_delay_minutes: settings.reply_delay_minutes,
    p_cooldown_hours: settings.commenter_cooldown_hours,
    p_video_filter_mode: settings.eligible_video_filter_mode,
    p_video_ids: settings.eligible_video_ids,
  })
  const [dailyResult, lastReplyResult, scopeResult] = await Promise.all([
    dailyPromise, lastReplyPromise, scopeHashPromise,
  ])
  if (dailyResult.error || lastReplyResult.error || scopeResult.error) {
    console.error('[YouTube automation eligibility] Safety lookup failed:', dailyResult.error?.code ?? lastReplyResult.error?.code ?? scopeResult.error?.code)
    return NextResponse.json({
      decision: 'manual_review', reason: 'eligibility_unverified', runtimeEnabled: false,
    })
  }

  const consentCurrent = settings.publishing_mode === 'auto_publish'
    && settings.auto_publish_authorized_at !== null
    && settings.auto_publish_consent_version === 'youtube-auto-publish-v1'
    && settings.auto_publish_revoked_at === null
    && settings.auto_publish_consent_scope_hash === scopeResult.data
  const decision = evaluateYouTubeAutoPublishEligibility({
    mode: settings.publishing_mode,
    emergencyPaused: settings.emergency_paused,
    consentCurrent,
    categoryRules: parseYouTubeCategoryRules(settings.category_rules) ?? DEFAULT_YOUTUBE_CATEGORY_RULES,
    minConfidence: Number(settings.min_auto_publish_confidence),
    replyDelayMinutes: settings.reply_delay_minutes,
    commenterCooldownHours: settings.commenter_cooldown_hours,
    videoFilterMode: settings.eligible_video_filter_mode,
    eligibleVideoIds: settings.eligible_video_ids,
    maxDailyPublishes: settings.max_auto_publishes_per_day,
    dailyPublishCount: dailyResult.data?.reserved_count ?? 0,
    category: queue.category,
    confidence: queue.category_confidence === null ? null : Number(queue.category_confidence),
    commentText: queue.comment_text,
    commentPublishedAt: queue.comment_published_at,
    videoId: queue.video_id,
    authorChannelId: queue.author_channel_id,
    connectedChannelId: access.connection.channelId,
    replyVerificationStatus: queue.reply_verification_status,
    requiresManualReview: queue.requires_manual_review,
    publishedReplyId: queue.published_reply_id,
    processingState: queue.processing_state,
    publishResultUncertain: queue.publish_result_uncertain,
    lastPublishedToCommenterAt: lastReplyResult.data?.published_at ?? null,
    now: new Date().toISOString(),
  })
  return NextResponse.json({ ...decision, runtimeEnabled: false })
}
