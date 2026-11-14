export const YOUTUBE_DRAFT_CATEGORIES = [
  'praise',
  'question',
  'complaint',
  'feedback',
  'other_legitimate',
  'spam',
] as const

export type YouTubeDraftCategory = typeof YOUTUBE_DRAFT_CATEGORIES[number]

export type YouTubeDraftDecision = {
  category: YouTubeDraftCategory
  confidence: number
  shouldDraft: boolean
  reply: string | null
}

export function normalizeYouTubeDraftDecision(value: {
  category: string
  confidence: number
  reply: string
}): YouTubeDraftDecision {
  if (!YOUTUBE_DRAFT_CATEGORIES.includes(value.category as YouTubeDraftCategory)) {
    throw new Error('AI returned an unsupported YouTube comment category')
  }
  if (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new Error('AI returned an invalid YouTube classification confidence')
  }

  const category = value.category as YouTubeDraftCategory
  return {
    category,
    confidence: Math.round(value.confidence * 1000) / 1000,
    shouldDraft: category !== 'spam',
    reply: category === 'spam' ? null : value.reply.trim(),
  }
}

export function isClaimedYouTubeDraftSafe(value: {
  processingState: string
  replyVerificationStatus: string
  authorChannelId: string | null
  connectedChannelId: string
}): boolean {
  return value.processingState === 'generating'
    && value.replyVerificationStatus === 'verified_unpublished'
    && Boolean(value.authorChannelId)
    && value.authorChannelId !== value.connectedChannelId
}
