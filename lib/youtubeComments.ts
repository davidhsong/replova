import 'server-only'

import { findChannelReply, type ChannelReplyStatus } from './youtubeReplyStatus'
import { requestYouTubeCommentThreadsPage } from './youtubeCommentApiPage'

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
  let response: Response
  let data: Awaited<ReturnType<typeof requestYouTubeCommentThreadsPage>>['data']
  try {
    const page = await requestYouTubeCommentThreadsPage({
      accessToken,
      channelId,
      pageToken,
      maxResults,
      signal,
    })
    response = page.response
    data = page.data
  } catch {
    if (signal?.aborted) throw signal.reason
    throw new YouTubeCommentsError('YouTube comments are temporarily unavailable.', 502, 'networkError')
  }

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
