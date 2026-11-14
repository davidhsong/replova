export type YouTubeQueueFilter = 'needs_review' | 'approved' | 'published' | 'skipped' | 'failed'
export type YouTubeQueueAction = 'save' | 'approve' | 'reject' | 'begin_regenerate'

export const YOUTUBE_QUEUE_FILTERS: YouTubeQueueFilter[] = [
  'needs_review', 'approved', 'published', 'skipped', 'failed',
]

export function isYouTubeQueueFilter(value: string): value is YouTubeQueueFilter {
  return YOUTUBE_QUEUE_FILTERS.includes(value as YouTubeQueueFilter)
}

export function sanitizeYouTubeQueueDraft(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
  return normalized.length >= 1 && normalized.length <= 1000 ? normalized : null
}

export function canUseYouTubeQueueAction(item: {
  processingState: string
  approvalStatus: string
  replyVerificationStatus: string
  publishedReplyId: string | null
}, action: YouTubeQueueAction): boolean {
  if (item.publishedReplyId || ['published', 'publishing', 'publish_uncertain'].includes(item.processingState)) {
    return false
  }
  if (action === 'save') {
    return ['awaiting_approval', 'ready_to_publish'].includes(item.processingState)
  }
  if (action === 'approve') {
    return item.processingState === 'awaiting_approval'
      && item.approvalStatus === 'pending'
      && item.replyVerificationStatus === 'verified_unpublished'
  }
  if (action === 'reject') {
    return ['awaiting_approval', 'ready_to_publish', 'draft_failed'].includes(item.processingState)
  }
  return ['awaiting_approval', 'ready_to_publish', 'draft_failed'].includes(item.processingState)
    && item.replyVerificationStatus === 'verified_unpublished'
}

export function canManuallyPublishYouTubeQueueItem(item: {
  processingState: string
  approvalStatus: string
  replyVerificationStatus: string
  publishedReplyId: string | null
  publishResultUncertain: boolean
  draft: string | null
}): boolean {
  return ['ready_to_publish', 'publish_failed'].includes(item.processingState)
    && item.approvalStatus === 'approved'
    && item.replyVerificationStatus === 'verified_unpublished'
    && !item.publishedReplyId
    && !item.publishResultUncertain
    && Boolean(item.draft?.trim())
}
