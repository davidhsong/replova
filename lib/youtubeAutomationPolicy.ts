export function isYouTubeAutomationEnabled(settings: { automation_enabled: boolean } | null): boolean {
  return settings?.automation_enabled === true
}

export function nextYouTubeSyncCheckpoint({
  currentCycleStartedAt,
  nextPageToken,
  now,
}: {
  currentCycleStartedAt: string | null
  nextPageToken: string | null
  now: string
}) {
  return {
    nextPageToken,
    cycleStartedAt: nextPageToken ? (currentCycleStartedAt ?? now) : null,
    cycleComplete: nextPageToken === null,
  }
}

export function getYouTubeDraftCapacity({
  hourlyUsage,
  hourlyLimit,
  spentUsd,
  budgetUsd,
  configuredBatchSize,
}: {
  hourlyUsage: number
  hourlyLimit: number
  spentUsd: number
  budgetUsd: number
  configuredBatchSize: number
}) {
  const budgetExhausted = spentUsd >= budgetUsd
  const remainingHourly = Math.max(0, hourlyLimit - hourlyUsage)

  return {
    budgetExhausted,
    rateLimited: remainingHourly === 0,
    remainingHourly,
    batchSize: budgetExhausted || remainingHourly === 0
      ? 0
      : Math.max(1, Math.min(configuredBatchSize, remainingHourly, 100)),
  }
}

export function sanitizeYouTubeAutomationErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'reason' in error && typeof error.reason === 'string') {
    return sanitizeCode(error.reason)
  }
  if (error instanceof Error && /^[a-z0-9_:-]{1,200}$/i.test(error.message)) {
    return sanitizeCode(error.message)
  }
  return 'automation_run_failed'
}

export function buildYouTubeSyncQueueRow({
  connectionId,
  comment,
  current,
  checkedAt,
}: {
  connectionId: string
  comment: {
    id: string
    threadId: string
    videoId: string
    authorChannelId: string | null
    author: string
    text: string
    date: string
    updatedAt: string | null
    replyCount: number
    replyStatus:
      | { status: 'published'; replyId: string; publishedAt: string | null }
      | { status: 'not_published' }
      | { status: 'unknown'; reason: string }
  }
  current?: {
    processing_state: string
    reply_verification_checked_at: string | null
    reply_verification_error: string | null
  }
  checkedAt: string
}) {
  const preservePublishedVerification = current?.processing_state === 'published'
    && comment.replyStatus.status !== 'published'

  return {
    connection_id: connectionId,
    youtube_comment_id: comment.id,
    youtube_thread_id: comment.threadId,
    video_id: comment.videoId,
    author_channel_id: comment.authorChannelId,
    author_display_name: comment.author,
    comment_text: comment.text,
    comment_published_at: comment.date,
    comment_updated_at: comment.updatedAt,
    reply_count: comment.replyCount,
    reply_verification_status: preservePublishedVerification
      ? 'verified_published'
      : comment.replyStatus.status === 'published'
        ? 'verified_published'
        : comment.replyStatus.status === 'not_published' ? 'verified_unpublished' : 'unknown',
    reply_verification_checked_at: preservePublishedVerification
      ? current.reply_verification_checked_at
      : checkedAt,
    reply_verification_error: preservePublishedVerification
      ? current.reply_verification_error
      : comment.replyStatus.status === 'unknown' ? comment.replyStatus.reason : null,
  }
}

function sanitizeCode(value: string): string {
  const sanitized = value.replace(/[^a-z0-9_:-]/gi, '_').slice(0, 200)
  return sanitized || 'automation_run_failed'
}
