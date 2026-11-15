const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

export type YouTubeCommentThreadResponse = {
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
    replies?: {
      comments?: Array<{
        id?: string
        snippet?: {
          authorChannelId?: { value?: string }
          publishedAt?: string
        }
      }>
    }
  }>
  error?: { errors?: Array<{ reason?: string }> }
}

export async function requestYouTubeCommentThreadsPage({
  accessToken,
  channelId,
  pageToken,
  maxResults,
  signal,
  fetchImpl = fetch,
}: {
  accessToken: string
  channelId: string
  pageToken?: string
  maxResults: number
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<{
  response: Response
  data: YouTubeCommentThreadResponse
}> {
  const params = new URLSearchParams({
    part: 'snippet,replies',
    allThreadsRelatedToChannelId: channelId,
    maxResults: String(Math.max(1, Math.min(100, maxResults))),
    order: 'time',
    textFormat: 'plainText',
  })
  if (pageToken) params.set('pageToken', pageToken)

  const response = await fetchImpl(`${YOUTUBE_API}/commentThreads?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  })
  const data = await response.json().catch(() => ({})) as YouTubeCommentThreadResponse
  return { response, data }
}
