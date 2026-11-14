export type KnowledgeEntryType = 'faq' | 'fact' | 'video_context'
export type KnowledgeScopeType = 'general' | 'youtube_video'

export type ReplyKnowledgeEntry = {
  id: string
  entryType: KnowledgeEntryType
  title: string
  content: string
  scopeType: KnowledgeScopeType
  scopeKey: string | null
  sourceTitle?: string | null
  sourceDescription?: string | null
}

export type ReplyKnowledgeBase = {
  description: string
  responseGuidelines: string
  entries: ReplyKnowledgeEntry[]
}

export type SelectedReplyKnowledge = {
  businessDescription: string | null
  responseGuidelines: string | null
  video: {
    entryId: string
    videoId: string
    title: string | null
    description: string | null
    customContext: string | null
  } | null
  facts: Array<{ id: string; type: 'faq' | 'fact'; title: string; content: string; scope: KnowledgeScopeType }>
  entryIds: string[]
  hasSupportingContext: boolean
  hasConflicts: boolean
  conflictSubjects: string[]
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'do', 'does', 'for', 'from',
  'how', 'i', 'if', 'in', 'is', 'it', 'of', 'on', 'or', 'our', 'that', 'the', 'this', 'to',
  'was', 'we', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'you', 'your',
])

const TOKEN_ALIASES: Record<string, string> = {
  cost: 'price', costs: 'price', pricing: 'price', priced: 'price',
  refunding: 'refund', refunds: 'refund',
  hours: 'schedule', open: 'schedule', opening: 'schedule',
  shipping: 'delivery', ships: 'delivery', shipped: 'delivery',
}

function clean(value: string, maxLength: number): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function tokens(value: string): Set<string> {
  const values = clean(value, 10_000).toLowerCase().match(/[a-z0-9]{2,}/g) ?? []
  return new Set(values
    .map(token => TOKEN_ALIASES[token] ?? token)
    .filter(token => !STOP_WORDS.has(token)))
}

function overlapScore(query: Set<string>, value: string, weight = 1): number {
  let score = 0
  for (const token of tokens(value)) if (query.has(token)) score += weight
  return score
}

function subjectKey(entry: ReplyKnowledgeEntry): string {
  return `${entry.entryType}:${clean(entry.title, 500).toLowerCase()}`
}

function distinctContent(entries: ReplyKnowledgeEntry[]): boolean {
  return new Set(entries.map(entry => clean(entry.content, 4000).toLowerCase())).size > 1
}

export function selectRelevantReplyKnowledge({
  knowledge,
  commentText,
  videoId,
  maxFacts = 6,
}: {
  knowledge: ReplyKnowledgeBase | null
  commentText: string
  videoId?: string | null
  maxFacts?: number
}): SelectedReplyKnowledge {
  if (!knowledge) {
    return {
      businessDescription: null,
      responseGuidelines: null,
      video: null,
      facts: [],
      entryIds: [],
      hasSupportingContext: false,
      hasConflicts: false,
      conflictSubjects: [],
    }
  }

  const query = tokens(commentText)
  const businessDescription = clean(knowledge.description, 1600) || null
  const responseGuidelines = clean(knowledge.responseGuidelines, 1200) || null
  const videoEntry = videoId
    ? knowledge.entries.find(entry => entry.entryType === 'video_context'
      && entry.scopeType === 'youtube_video' && entry.scopeKey === videoId)
    : undefined
  const video = videoEntry ? {
    entryId: videoEntry.id,
    videoId: videoEntry.scopeKey ?? videoId ?? '',
    title: clean(videoEntry.sourceTitle ?? videoEntry.title, 300) || null,
    description: clean(videoEntry.sourceDescription ?? '', 2400) || null,
    customContext: clean(videoEntry.content, 1600) || null,
  } : null

  const candidates = knowledge.entries.filter(entry => entry.entryType !== 'video_context'
    && (entry.scopeType === 'general' || (videoId && entry.scopeKey === videoId)))
  const groups = new Map<string, ReplyKnowledgeEntry[]>()
  for (const entry of candidates) {
    const key = subjectKey(entry)
    const existing = groups.get(key) ?? []
    existing.push(entry)
    groups.set(key, existing)
  }

  const conflictSubjects: string[] = []
  const scored: Array<{ entry: ReplyKnowledgeEntry; score: number }> = []
  for (const group of groups.values()) {
    const videoSpecific = group.filter(entry => entry.scopeType === 'youtube_video' && entry.scopeKey === videoId)
    const effective = videoSpecific.length > 0 ? videoSpecific : group.filter(entry => entry.scopeType === 'general')
    const relevance = Math.max(...effective.map(entry =>
      overlapScore(query, entry.title, 4) + overlapScore(query, entry.content)))
    if (distinctContent(effective)) {
      if (relevance > 0) conflictSubjects.push(clean(effective[0].title, 160))
      continue
    }
    const entry = effective[0]
    if (entry && relevance > 0) {
      scored.push({ entry, score: relevance + (entry.scopeType === 'youtube_video' ? 8 : 0) })
    }
  }

  const facts = scored
    .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title))
    .slice(0, Math.max(1, Math.min(maxFacts, 10)))
    .map(({ entry }) => ({
      id: entry.id,
      type: entry.entryType as 'faq' | 'fact',
      title: clean(entry.title, 500),
      content: clean(entry.content, 1200),
      scope: entry.scopeType,
    }))

  const generalSupport = businessDescription ? overlapScore(query, businessDescription) > 0 : false
  const videoSupport = video
    ? [video.title, video.description, video.customContext].some(value => value ? overlapScore(query, value) > 0 : false)
    : false
  const entryIds = [...new Set([
    ...(video ? [video.entryId] : []),
    ...facts.map(fact => fact.id),
  ])]

  return {
    businessDescription,
    responseGuidelines,
    video,
    facts,
    entryIds,
    hasSupportingContext: facts.length > 0 || generalSupport || videoSupport,
    hasConflicts: conflictSubjects.length > 0,
    conflictSubjects,
  }
}

export function knowledgePromptData(context: SelectedReplyKnowledge): Record<string, unknown> {
  return {
    business_or_channel_description: context.businessDescription,
    response_guidelines: context.responseGuidelines,
    video: context.video ? {
      video_id: context.video.videoId,
      title: context.video.title,
      description: context.video.description,
      custom_context: context.video.customContext,
      precedence: 'Video-specific context overrides general context when they directly conflict.',
    } : null,
    relevant_facts_and_faqs: context.facts.map(fact => ({
      type: fact.type,
      subject_or_question: fact.title,
      answer_or_fact: fact.content,
      scope: fact.scope,
    })),
    conflict_warning: context.hasConflicts
      ? `Conflicting saved information exists for: ${context.conflictSubjects.join(', ')}. Do not assert those facts.`
      : null,
  }
}

export function resolveKnowledgeManualReview({
  category,
  modelRequiresReview,
  modelReason,
  context,
}: {
  category?: string | null
  modelRequiresReview: boolean
  modelReason?: string | null
  context?: SelectedReplyKnowledge
}): { requiresManualReview: boolean; manualReviewReason: string | null } {
  const unsupportedQuestion = category === 'question' && !context?.hasSupportingContext
  const requiresManualReview = modelRequiresReview || context?.hasConflicts === true || unsupportedQuestion
  if (!requiresManualReview) return { requiresManualReview: false, manualReviewReason: null }

  const reason = clean(modelReason ?? '', 500)
    || (context?.hasConflicts
      ? 'Saved context contains conflicting facts.'
      : 'The available context does not support a factual answer.')
  return { requiresManualReview: true, manualReviewReason: reason }
}

export function sanitizeKnowledgeInput(value: unknown, maxLength: number, required = false): string | null {
  if (typeof value !== 'string') return null
  const sanitized = value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength)
  if (required && !sanitized) return null
  return sanitized
}
