import 'server-only'

import { findChannelReply, type ChannelReplyStatus, type YouTubeReplySummary } from './youtubeReplyStatus'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

type YouTubeCommentThreadResponse = {
  nextPageToken?: string
  items?: Array<{
    id?: string
    snippet?: {
      videoId?: string
      totalReplyCount?: number
      topLevelComment?: {
        id?: string
        snippet?: {
          videoId?: string
          authorChannelId?: { value?: string }
          authorDisplayName?: string
          textDisplay?: string
          publishedAt?: string
          updatedAt?: string
        }
      }
    }
    replies?: { comments?: YouTubeReplySummary[] }
  }>
  error?: { errors?: Array<{ reason?: string }> }
}

export type FetchedYouTubeComment = {
  id: string
  threadId: string
  videoId: string
  authorChannelId: string | null
  author: string
  text: string
  date: string
  updatedAt: string | null
  replyCount: number
  replyStatus: ChannelReplyStatus
  publishedReplyId: string | null
  publishedReplyUrl: string | null
}

export class YouTubeCommentsError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(message)
    this.name = 'YouTubeCommentsError'
  }
}

function errorMessage(status: number, reason: string): string {
  if (status === 401) return 'YouTube rejected the authorization. Reconnect YouTube and try again.'
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return 'The YouTube API quota is currently exhausted. Try again later.'
  if (reason === 'commentsDisabled') return 'Comments are disabled for the requested YouTube content.'
  if (status === 403) return 'YouTube did not allow access to these comments.'
  if (status === 404) return 'The connected YouTube channel was not found.'
  return 'YouTube comments are temporarily unavailable.'
}

export async function fetchYouTubeCommentsPage({
  accessToken,
  channelId,
  pageToken,
  maxResults,
  signal,
}: {
  accessToken: string
  channelId: string
  pageToken?: string
  maxResults: number
  signal?: AbortSignal
}): Promise<{
  comments: FetchedYouTubeComment[]
  nextPageToken: string | null
  replyVerificationWarning: boolean
}> {
  const params = new URLSearchParams({
    part: 'snippet,replies',
    allThreadsRelatedToChannelId: channelId,
    maxResults: String(Math.max(1, Math.min(100, maxResults))),
    order: 'time',
    textFormat: 'plainText',
  })
  if (pageToken) params.set('pageToken', pageToken)

  let response: Response
  try {
    response = await fetch(`${YOUTUBE_API}/commentThreads?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal,
    })
  } catch {
    if (signal?.aborted) throw signal.reason
    throw new YouTubeCommentsError('YouTube comments are temporarily unavailable.', 502, 'networkError')
  }

  const data = await response.json().catch(() => ({})) as YouTubeCommentThreadResponse
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? 'unknown'
    throw new YouTubeCommentsError(errorMessage(response.status, reason), response.status, reason)
  }

  const comments: FetchedYouTubeComment[] = []
  let replyVerificationWarning = false

  for (const thread of data.items ?? []) {
    const comment = thread.snippet?.topLevelComment
    const snippet = comment?.snippet
    const id = comment?.id
    const videoId = thread.snippet?.videoId ?? snippet?.videoId
    if (!thread.id || !id || !videoId || !snippet?.publishedAt || !snippet.textDisplay?.trim()) continue

    const replyStatus = await findChannelReply({
      accessToken,
      parentId: id,
      channelId,
      initialReplies: thread.replies?.comments ?? [],
      totalReplyCount: thread.snippet?.totalReplyCount ?? 0,
      signal,
    })
    if (replyStatus.status === 'unknown') replyVerificationWarning = true

    const publishedReplyId = replyStatus.status === 'published' ? replyStatus.replyId : null
    const publishedReplyUrl = publishedReplyId
      ? `https://www.youtube.com/watch?${new URLSearchParams({ v: videoId, lc: publishedReplyId }).toString()}`
      : null

    comments.push({
      id,
      threadId: thread.id,
      videoId,
      authorChannelId: snippet?.authorChannelId?.value ?? null,
      author: snippet.authorDisplayName ?? 'Unknown author',
      text: snippet.textDisplay ?? '',
      date: snippet.publishedAt,
      updatedAt: snippet.updatedAt ?? null,
      replyCount: thread.snippet?.totalReplyCount ?? 0,
      replyStatus,
      publishedReplyId,
      publishedReplyUrl,
    })
  }

  return {
    comments,
    nextPageToken: data.nextPageToken ?? null,
    replyVerificationWarning,
  }
}
