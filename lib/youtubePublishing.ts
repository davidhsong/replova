import 'server-only'

import { findChannelReply, type YouTubeReplySummary } from './youtubeReplyStatus'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

type YouTubeErrorBody = {
  error?: { errors?: Array<{ reason?: string }> }
}

type ThreadResponse = YouTubeErrorBody & {
  items?: Array<{
    id?: string
    snippet?: {
      channelId?: string
      videoId?: string
      canReply?: boolean
      totalReplyCount?: number
      topLevelComment?: { id?: string }
    }
    replies?: { comments?: YouTubeReplySummary[] }
  }>
}

export type YouTubePublishOutcome =
  | {
      status: 'published' | 'already_published'
      replyId: string
      replyUrl: string
      publishedAt: string
    }
  | {
      status: 'failed'
      httpStatus: number
      reason: string
      message: string
      uncertain: boolean
      blocked: boolean
    }

function apiReason(data: YouTubeErrorBody): string {
  return data.error?.errors?.[0]?.reason ?? 'unknown'
}

export function youtubePublishError(status: number, reason: string): { status: number; message: string } {
  if (status === 401) {
    return { status: 401, message: 'YouTube authorization expired. Reconnect YouTube and try again.' }
  }
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return { status: 429, message: 'The YouTube API quota is currently exhausted. Try again later.' }
  }
  if (reason === 'commentTextTooLong') {
    return { status: 400, message: 'The reply is too long for YouTube.' }
  }
  if (reason === 'commentsDisabled' || reason === 'operationNotSupported' || reason === 'parentCommentIsPrivate') {
    return { status: 400, message: 'YouTube does not allow replies to this comment.' }
  }
  if (status === 403) {
    return { status: 403, message: 'YouTube did not allow this reply to be published.' }
  }
  if (status === 404) {
    return { status: 404, message: 'The YouTube comment could not be found.' }
  }
  return { status: 502, message: 'YouTube could not publish this reply.' }
}

function replyUrl(videoId: string, replyId: string): string {
  const url = new URL('https://www.youtube.com/watch')
  url.searchParams.set('v', videoId)
  url.searchParams.set('lc', replyId)
  return url.toString()
}

function failure(
  httpStatus: number,
  reason: string,
  options: { uncertain?: boolean; blocked?: boolean; message?: string } = {}
): YouTubePublishOutcome {
  const mapped = youtubePublishError(httpStatus, reason)
  return {
    status: 'failed',
    httpStatus: mapped.status,
    reason,
    message: options.message ?? mapped.message,
    uncertain: options.uncertain ?? false,
    blocked: options.blocked ?? false,
  }
}

export async function verifyAndPublishYouTubeReply({
  accessToken,
  channelId,
  commentId,
  threadId,
  replyText,
}: {
  accessToken: string
  channelId: string
  commentId: string
  threadId: string
  replyText: string
}): Promise<YouTubePublishOutcome> {
  const verifyParams = new URLSearchParams({ part: 'snippet,replies', id: threadId, textFormat: 'plainText' })
  let verifyResponse: Response
  try {
    verifyResponse = await fetch(`${YOUTUBE_API}/commentThreads?${verifyParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
  } catch {
    return failure(502, 'verificationNetworkError', {
      message: 'The comment could not be verified. Nothing was published; try again later.',
    })
  }

  const verifyData = await verifyResponse.json().catch(() => ({})) as ThreadResponse
  if (!verifyResponse.ok) return failure(verifyResponse.status, apiReason(verifyData))

  const thread = verifyData.items?.[0]
  const snippet = thread?.snippet
  if (
    !thread || thread.id !== threadId || snippet?.topLevelComment?.id !== commentId
    || !snippet.videoId || snippet.channelId !== channelId
  ) {
    return failure(403, 'channelOwnershipMismatch', {
      blocked: true,
      message: 'This comment does not belong to the connected channel.',
    })
  }
  if (snippet.canReply !== true) {
    return failure(400, 'cannotReply', {
      message: 'YouTube does not allow replies to this comment.',
    })
  }

  const duplicateCheck = await findChannelReply({
    accessToken,
    parentId: commentId,
    channelId,
    initialReplies: thread.replies?.comments ?? [],
    totalReplyCount: snippet.totalReplyCount ?? 0,
  })
  if (duplicateCheck.status === 'unknown') {
    return failure(duplicateCheck.httpStatus, duplicateCheck.reason, {
      message: 'The existing reply status could not be verified. Nothing was published; try again later.',
    })
  }
  if (duplicateCheck.status === 'published') {
    return {
      status: 'already_published',
      replyId: duplicateCheck.replyId,
      replyUrl: replyUrl(snippet.videoId, duplicateCheck.replyId),
      publishedAt: duplicateCheck.publishedAt ?? new Date().toISOString(),
    }
  }

  let publishResponse: Response
  try {
    publishResponse = await fetch(`${YOUTUBE_API}/comments?part=snippet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ snippet: { parentId: commentId, textOriginal: replyText } }),
      cache: 'no-store',
    })
  } catch {
    return failure(502, 'publishNetworkError', {
      uncertain: true,
      blocked: true,
      message: 'The publish result is uncertain. Check YouTube before trying again.',
    })
  }

  const publishData = await publishResponse.json().catch(() => ({})) as YouTubeErrorBody & {
    id?: string
    snippet?: { publishedAt?: string }
  }
  if (!publishResponse.ok) {
    const reason = apiReason(publishData)
    if (publishResponse.status >= 500) {
      return failure(502, reason, {
        uncertain: true,
        blocked: true,
        message: 'The publish result is uncertain. Check YouTube before trying again.',
      })
    }
    return failure(publishResponse.status, reason)
  }
  if (!publishData.id) {
    return failure(502, 'missingReplyId', {
      uncertain: true,
      blocked: true,
      message: 'YouTube accepted the request but returned an uncertain result. Check YouTube before retrying.',
    })
  }

  return {
    status: 'published',
    replyId: publishData.id,
    replyUrl: replyUrl(snippet.videoId, publishData.id),
    publishedAt: publishData.snippet?.publishedAt ?? new Date().toISOString(),
  }
}
