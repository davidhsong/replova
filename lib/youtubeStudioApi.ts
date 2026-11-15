const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'
const MAX_PLAYLIST_PAGES = 4
const MAX_UPLOAD_PAGES = 20
const MAX_CUSTOM_PLAYLIST_ITEM_PAGES = 40
const MAX_PAGES_PER_CUSTOM_PLAYLIST = 10
const MAX_VIDEO_IDS = 1500

type Thumbnail = { url?: string; width?: number; height?: number }
type Thumbnails = Record<string, Thumbnail | undefined>

type ApiErrorBody = {
  error?: { errors?: Array<{ reason?: string }>; message?: string }
}

export type YouTubeStudioChannel = {
  channelId: string
  title: string
  avatarUrl: string | null
  channelUrl: string
  uploadsPlaylistId: string
  subscriberCount: number | null
  subscriberCountHidden: boolean
  videoCount: number | null
  viewCount: number | null
}

export type YouTubeStudioVideo = {
  videoId: string
  channelId: string
  title: string
  description: string
  thumbnailUrl: string | null
  publishedAt: string | null
  viewCount: number | null
  commentCount: number | null
  privacyStatus: 'public' | 'unlisted' | 'private' | null
  uploadPosition: number | null
}

export type YouTubeStudioPlaylist = {
  playlistId: string
  channelId: string
  title: string
  description: string
  thumbnailUrl: string | null
  publishedAt: string | null
  itemCount: number
  membershipComplete: boolean
  memberships: Array<{ videoId: string; position: number }>
}

export type YouTubeStudioCatalog = {
  channel: YouTubeStudioChannel
  videos: YouTubeStudioVideo[]
  playlists: YouTubeStudioPlaylist[]
  uploadsComplete: boolean
  playlistsComplete: boolean
  partial: boolean
  pagesFetched: number
}

export class YouTubeStudioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reason: string
  ) {
    super(message)
    this.name = 'YouTubeStudioApiError'
  }
}

function errorMessage(status: number, reason: string): string {
  if (status === 401) return 'YouTube authorization expired. Reconnect YouTube and try again.'
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    return 'The YouTube API quota is exhausted. Try again after quota resets.'
  }
  if (status === 403) return 'YouTube did not allow access to this channel content.'
  if (status === 404) return 'The connected YouTube channel could not be found.'
  return 'YouTube channel content is temporarily unavailable.'
}

function thumbnailUrl(thumbnails: Thumbnails | undefined): string | null {
  if (!thumbnails) return null
  for (const key of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const value = thumbnails[key]?.url
    if (typeof value === 'string' && value.startsWith('https://')) return value.slice(0, 2048)
  }
  return null
}

function count(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function validResourceId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(value)
}

async function apiGet<T>({
  path,
  params,
  accessToken,
  signal,
  fetchImpl,
}: {
  path: string
  params: URLSearchParams
  accessToken: string
  signal?: AbortSignal
  fetchImpl: typeof fetch
}): Promise<T> {
  let response: Response
  try {
    response = await fetchImpl(`${YOUTUBE_API}/${path}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
      signal,
    })
  } catch {
    if (signal?.aborted) throw signal.reason
    throw new YouTubeStudioApiError('YouTube channel content is temporarily unavailable.', 502, 'networkError')
  }

  const data = await response.json().catch(() => ({})) as T & ApiErrorBody
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason ?? 'unknown'
    throw new YouTubeStudioApiError(errorMessage(response.status, reason), response.status, reason)
  }
  return data
}

async function collectPages<T>({
  path,
  params,
  accessToken,
  maxPages,
  signal,
  fetchImpl,
}: {
  path: string
  params: URLSearchParams
  accessToken: string
  maxPages: number
  signal?: AbortSignal
  fetchImpl: typeof fetch
}): Promise<{ items: T[]; complete: boolean; pages: number }> {
  const items: T[] = []
  let pageToken: string | undefined
  let pages = 0
  do {
    const pageParams = new URLSearchParams(params)
    if (pageToken) pageParams.set('pageToken', pageToken)
    const data = await apiGet<{ items?: T[]; nextPageToken?: string }>({
      path,
      params: pageParams,
      accessToken,
      signal,
      fetchImpl,
    })
    items.push(...(data.items ?? []))
    pageToken = data.nextPageToken
    pages += 1
  } while (pageToken && pages < maxPages)
  return { items, complete: !pageToken, pages }
}

export async function fetchYouTubeStudioCatalog({
  accessToken,
  expectedChannelId,
  signal,
  fetchImpl = fetch,
}: {
  accessToken: string
  expectedChannelId: string
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}): Promise<YouTubeStudioCatalog> {
  const channelData = await apiGet<{
    items?: Array<{
      id?: string
      snippet?: { title?: string; thumbnails?: Thumbnails }
      contentDetails?: { relatedPlaylists?: { uploads?: string } }
      statistics?: {
        subscriberCount?: string
        hiddenSubscriberCount?: boolean
        videoCount?: string
        viewCount?: string
      }
    }>
  }>({
    path: 'channels',
    params: new URLSearchParams({ part: 'snippet,contentDetails,statistics', mine: 'true' }),
    accessToken,
    signal,
    fetchImpl,
  })
  const channelItem = channelData.items?.find(item => item.id === expectedChannelId)
  const uploadsPlaylistId = channelItem?.contentDetails?.relatedPlaylists?.uploads
  if (!channelItem?.id || !channelItem.snippet?.title || !validResourceId(uploadsPlaylistId)) {
    throw new YouTubeStudioApiError('The authorized YouTube channel did not match this Replova connection.', 403, 'channelMismatch')
  }

  const channel: YouTubeStudioChannel = {
    channelId: channelItem.id,
    title: channelItem.snippet.title.slice(0, 300),
    avatarUrl: thumbnailUrl(channelItem.snippet.thumbnails),
    channelUrl: `https://www.youtube.com/channel/${encodeURIComponent(channelItem.id)}`,
    uploadsPlaylistId,
    subscriberCount: count(channelItem.statistics?.subscriberCount),
    subscriberCountHidden: channelItem.statistics?.hiddenSubscriberCount === true,
    videoCount: count(channelItem.statistics?.videoCount),
    viewCount: count(channelItem.statistics?.viewCount),
  }

  const playlistPage = await collectPages<{
    id?: string
    snippet?: {
      channelId?: string
      title?: string
      description?: string
      publishedAt?: string
      thumbnails?: Thumbnails
    }
    contentDetails?: { itemCount?: number }
  }>({
    path: 'playlists',
    params: new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true', maxResults: '50' }),
    accessToken,
    maxPages: MAX_PLAYLIST_PAGES,
    signal,
    fetchImpl,
  })

  const uploadItemsPage = await collectPages<{
    snippet?: { position?: number; resourceId?: { videoId?: string } }
    contentDetails?: { videoId?: string }
  }>({
    path: 'playlistItems',
    params: new URLSearchParams({ part: 'snippet,contentDetails', playlistId: uploadsPlaylistId, maxResults: '50' }),
    accessToken,
    maxPages: MAX_UPLOAD_PAGES,
    signal,
    fetchImpl,
  })
  let pagesFetched = 1 + playlistPage.pages + uploadItemsPage.pages
  const uploadPositions = new Map<string, number>()
  for (const item of uploadItemsPage.items) {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
    if (validResourceId(videoId)) uploadPositions.set(videoId, Math.max(0, item.snippet?.position ?? uploadPositions.size))
  }

  const playlistSeeds = playlistPage.items.flatMap(item => {
    if (
      !validResourceId(item.id)
      || item.snippet?.channelId !== channel.channelId
      || !item.snippet.title
    ) return []
    return [{
      playlistId: item.id,
      channelId: channel.channelId,
      title: item.snippet.title.slice(0, 500),
      description: (item.snippet.description ?? '').slice(0, 5000),
      thumbnailUrl: thumbnailUrl(item.snippet.thumbnails),
      publishedAt: item.snippet.publishedAt ?? null,
      itemCount: Math.max(0, Math.floor(item.contentDetails?.itemCount ?? 0)),
    }]
  })

  let remainingCustomPages = MAX_CUSTOM_PLAYLIST_ITEM_PAGES
  const playlists: YouTubeStudioPlaylist[] = []
  const playlistVideoIds: string[] = []
  for (const seed of playlistSeeds) {
    if (remainingCustomPages <= 0) {
      playlists.push({ ...seed, membershipComplete: false, memberships: [] })
      continue
    }
    const maxPages = Math.min(MAX_PAGES_PER_CUSTOM_PLAYLIST, remainingCustomPages)
    const itemsPage = await collectPages<{
      snippet?: { position?: number; resourceId?: { videoId?: string } }
      contentDetails?: { videoId?: string }
    }>({
      path: 'playlistItems',
      params: new URLSearchParams({ part: 'snippet,contentDetails', playlistId: seed.playlistId, maxResults: '50' }),
      accessToken,
      maxPages,
      signal,
      fetchImpl,
    })
    pagesFetched += itemsPage.pages
    remainingCustomPages -= itemsPage.pages
    const memberships = itemsPage.items.flatMap((item, index) => {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
      if (!validResourceId(videoId)) return []
      playlistVideoIds.push(videoId)
      return [{ videoId, position: Math.max(0, item.snippet?.position ?? index) }]
    })
    playlists.push({ ...seed, membershipComplete: itemsPage.complete, memberships })
  }

  const orderedVideoIds = [...new Set([...uploadPositions.keys(), ...playlistVideoIds])]
  const limitedVideoIds = orderedVideoIds.slice(0, MAX_VIDEO_IDS)
  const videoItems: Array<{
    id?: string
    snippet?: {
      channelId?: string
      title?: string
      description?: string
      publishedAt?: string
      thumbnails?: Thumbnails
    }
    statistics?: { viewCount?: string; commentCount?: string }
    status?: { privacyStatus?: string }
  }> = []
  for (let index = 0; index < limitedVideoIds.length; index += 50) {
    const ids = limitedVideoIds.slice(index, index + 50)
    const data = await apiGet<{ items?: typeof videoItems }>({
      path: 'videos',
      params: new URLSearchParams({
        part: 'snippet,statistics,status',
        id: ids.join(','),
      }),
      accessToken,
      signal,
      fetchImpl,
    })
    videoItems.push(...(data.items ?? []))
    pagesFetched += 1
  }

  const videos = videoItems.flatMap(item => {
    if (
      !validResourceId(item.id)
      || item.snippet?.channelId !== channel.channelId
      || !item.snippet.title
    ) return []
    const privacy = item.status?.privacyStatus
    return [{
      videoId: item.id,
      channelId: channel.channelId,
      title: item.snippet.title.slice(0, 500),
      description: (item.snippet.description ?? '').slice(0, 5000),
      thumbnailUrl: thumbnailUrl(item.snippet.thumbnails),
      publishedAt: item.snippet.publishedAt ?? null,
      viewCount: count(item.statistics?.viewCount),
      commentCount: count(item.statistics?.commentCount),
      privacyStatus: privacy === 'public' || privacy === 'unlisted' || privacy === 'private' ? privacy : null,
      uploadPosition: uploadPositions.get(item.id) ?? null,
    } satisfies YouTubeStudioVideo]
  })
  const ownedVideoIds = new Set(videos.map(video => video.videoId))
  const ownedPlaylists = playlists.map(playlist => ({
    ...playlist,
    memberships: playlist.memberships.filter(membership => ownedVideoIds.has(membership.videoId)),
  }))

  const partial = !playlistPage.complete
    || !uploadItemsPage.complete
    || limitedVideoIds.length < orderedVideoIds.length
    || ownedPlaylists.some(playlist => !playlist.membershipComplete)
  return {
    channel,
    videos,
    playlists: ownedPlaylists,
    uploadsComplete: uploadItemsPage.complete && limitedVideoIds.length === orderedVideoIds.length,
    playlistsComplete: playlistPage.complete,
    partial,
    pagesFetched,
  }
}
