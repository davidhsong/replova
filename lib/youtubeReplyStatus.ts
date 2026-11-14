import 'server-only'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

export type YouTubeReplySummary = {
  id?: string
  snippet?: {
    authorChannelId?: { value?: string }
    publishedAt?: string
  }
}

type RepliesResponse = {
  items?: YouTubeReplySummary[]
  nextPageToken?: string
  error?: { errors?: Array<{ reason?: string }> }
}

export type ChannelReplyStatus =
  | { status: 'published'; replyId: string; publishedAt: string | null }
  | { status: 'not_published' }
  | { status: 'unknown'; httpStatus: number; reason: string }

export async function findChannelReply({
  accessToken,
  parentId,
  channelId,
  initialReplies,
  totalReplyCount,
  signal,
}: {
  accessToken: string
  parentId: string
  channelId: string
  initialReplies: YouTubeReplySummary[]
  totalReplyCount: number
  signal?: AbortSignal
}): Promise<ChannelReplyStatus> {
  const embeddedMatch = initialReplies.find(
    reply => reply.id && reply.snippet?.authorChannelId?.value === channelId
  )
  if (embeddedMatch?.id) {
    return { status: 'published', replyId: embeddedMatch.id, publishedAt: embeddedMatch.snippet?.publishedAt ?? null }
  }
  if (totalReplyCount <= initialReplies.length) return { status: 'not_published' }

  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ part: 'snippet', parentId, maxResults: '100', textFormat: 'plainText' })
    if (pageToken) params.set('pageToken', pageToken)

    let response: Response
    try {
      response = await fetch(`${YOUTUBE_API}/comments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        signal,
      })
    } catch {
      if (signal?.aborted) throw signal.reason
      return { status: 'unknown', httpStatus: 502, reason: 'networkError' }
    }

    const data = await response.json().catch(() => ({})) as RepliesResponse
    if (!response.ok) {
      return {
        status: 'unknown',
        httpStatus: response.status,
        reason: data.error?.errors?.[0]?.reason ?? 'unknown',
      }
    }

    const match = (data.items ?? []).find(
      reply => reply.id && reply.snippet?.authorChannelId?.value === channelId
    )
    if (match?.id) {
      return { status: 'published', replyId: match.id, publishedAt: match.snippet?.publishedAt ?? null }
    }
    pageToken = data.nextPageToken
  } while (pageToken)

  return { status: 'not_published' }
}
