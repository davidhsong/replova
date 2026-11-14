export const YOUTUBE_POLICY_CATEGORIES = [
  'praise',
  'thanks',
  'neutral_feedback',
  'question',
  'complaint',
  'negative_feedback',
  'other',
  'spam',
] as const

export const YOUTUBE_CATEGORY_ACTIONS = ['auto_publish', 'manual_review', 'skip'] as const

export type YouTubePolicyCategory = typeof YOUTUBE_POLICY_CATEGORIES[number]
export type YouTubeCategoryAction = typeof YOUTUBE_CATEGORY_ACTIONS[number]
export type YouTubeCategoryRules = Record<YouTubePolicyCategory, YouTubeCategoryAction>
export type YouTubePublishingMode = 'manual_approval' | 'auto_publish'
export type YouTubeVideoFilterMode = 'all' | 'include' | 'exclude'

export const YOUTUBE_AUTO_PUBLISH_CONSENT_VERSION = 'youtube-auto-publish-v1'

export const DEFAULT_YOUTUBE_CATEGORY_RULES: YouTubeCategoryRules = {
  praise: 'auto_publish',
  thanks: 'auto_publish',
  neutral_feedback: 'manual_review',
  question: 'manual_review',
  complaint: 'manual_review',
  negative_feedback: 'manual_review',
  other: 'manual_review',
  spam: 'skip',
}

const LEGACY_CATEGORY_ALIASES: Record<string, YouTubePolicyCategory> = {
  feedback: 'neutral_feedback',
  other_legitimate: 'other',
}

export function normalizeYouTubePolicyCategory(value: string | null): YouTubePolicyCategory | null {
  if (!value) return null
  const normalized = LEGACY_CATEGORY_ALIASES[value] ?? value
  return YOUTUBE_POLICY_CATEGORIES.includes(normalized as YouTubePolicyCategory)
    ? normalized as YouTubePolicyCategory
    : null
}

export function parseYouTubeCategoryRules(value: unknown): YouTubeCategoryRules | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).some(key => !YOUTUBE_POLICY_CATEGORIES.includes(key as YouTubePolicyCategory))) {
    return null
  }
  const rules = { ...DEFAULT_YOUTUBE_CATEGORY_RULES }
  for (const category of YOUTUBE_POLICY_CATEGORIES) {
    const action = input[category]
    if (action === undefined) continue
    if (!YOUTUBE_CATEGORY_ACTIONS.includes(action as YouTubeCategoryAction)) return null
    rules[category] = action as YouTubeCategoryAction
  }
  if (rules.spam !== 'skip') return null
  return rules
}

export function parseEligibleVideoIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 100) return null
  const ids: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const id = item.trim()
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return null
    if (!ids.includes(id)) ids.push(id)
  }
  return ids.sort()
}

export function containsSensitiveYouTubeContent(text: string): boolean {
  const normalized = text.toLowerCase()
  return /\b(suicide|self[- ]?harm|kill myself|medical emergency|call 911|police report|lawsuit|sue you|attorney|lawyer|death threat)\b/.test(normalized)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)
    || /(?:\+?\d[\d ().-]{7,}\d)/.test(text)
}

export type YouTubeEligibilityDecision = {
  decision: 'auto_publish' | 'manual_review' | 'skip' | 'defer'
  reason: string
  category: YouTubePolicyCategory | null
  eligibleAt: string | null
}

export function evaluateYouTubeAutoPublishEligibility(input: {
  mode: YouTubePublishingMode
  emergencyPaused: boolean
  consentCurrent: boolean
  categoryRules: YouTubeCategoryRules
  minConfidence: number
  replyDelayMinutes: number
  commenterCooldownHours: number
  videoFilterMode: YouTubeVideoFilterMode
  eligibleVideoIds: string[]
  maxDailyPublishes: number
  dailyPublishCount: number
  category: string | null
  confidence: number | null
  commentText: string
  commentPublishedAt: string
  videoId: string
  authorChannelId: string | null
  connectedChannelId: string
  replyVerificationStatus: string
  requiresManualReview: boolean
  publishedReplyId: string | null
  processingState: string
  publishResultUncertain: boolean
  lastPublishedToCommenterAt: string | null
  now: string
}): YouTubeEligibilityDecision {
  const category = normalizeYouTubePolicyCategory(input.category)
  const result = (
    decision: YouTubeEligibilityDecision['decision'],
    reason: string,
    eligibleAt: string | null = null
  ): YouTubeEligibilityDecision => ({ decision, reason, category, eligibleAt })

  if (category === 'spam') return result('skip', 'spam')
  if (input.authorChannelId && input.authorChannelId === input.connectedChannelId) {
    return result('skip', 'self_comment')
  }
  if (input.publishedReplyId || input.replyVerificationStatus === 'verified_published'
    || input.processingState === 'published') {
    return result('skip', 'already_answered')
  }
  if (input.publishResultUncertain) return result('manual_review', 'publish_status_uncertain')
  if (input.replyVerificationStatus !== 'verified_unpublished') {
    return result('manual_review', 'reply_status_unverified')
  }
  if (!input.authorChannelId) return result('manual_review', 'commenter_identity_unknown')
  if (!category) return result('manual_review', 'classification_ambiguous')
  if (input.requiresManualReview) return result('manual_review', 'factual_grounding_required')
  if (containsSensitiveYouTubeContent(input.commentText)) return result('manual_review', 'sensitive_content')

  const categoryAction = input.categoryRules[category]
  if (categoryAction === 'skip') return result('skip', 'category_rule')
  if (categoryAction !== 'auto_publish') return result('manual_review', 'category_rule')
  if (input.mode !== 'auto_publish') return result('manual_review', 'manual_approval_mode')
  if (!input.consentCurrent) return result('manual_review', 'consent_required')
  if (input.emergencyPaused) return result('manual_review', 'emergency_paused')
  if (input.confidence === null || input.confidence < input.minConfidence) {
    return result('manual_review', 'classification_confidence_low')
  }

  const videoIncluded = input.eligibleVideoIds.includes(input.videoId)
  if (input.videoFilterMode === 'include' && !videoIncluded) {
    return result('manual_review', 'video_not_included')
  }
  if (input.videoFilterMode === 'exclude' && videoIncluded) {
    return result('manual_review', 'video_excluded')
  }
  if (input.dailyPublishCount >= input.maxDailyPublishes) {
    return result('manual_review', 'daily_limit_reached')
  }

  const nowMs = Date.parse(input.now)
  const delayEligibleAt = Date.parse(input.commentPublishedAt) + input.replyDelayMinutes * 60_000
  if (!Number.isFinite(nowMs) || !Number.isFinite(delayEligibleAt)) {
    return result('manual_review', 'invalid_timing_data')
  }
  if (nowMs < delayEligibleAt) return result('defer', 'reply_delay', new Date(delayEligibleAt).toISOString())

  if (input.lastPublishedToCommenterAt) {
    const cooldownEligibleAt = Date.parse(input.lastPublishedToCommenterAt)
      + input.commenterCooldownHours * 60 * 60_000
    if (!Number.isFinite(cooldownEligibleAt)) return result('manual_review', 'invalid_cooldown_data')
    if (nowMs < cooldownEligibleAt) {
      return result('defer', 'commenter_cooldown', new Date(cooldownEligibleAt).toISOString())
    }
  }

  return result('auto_publish', 'eligible')
}
