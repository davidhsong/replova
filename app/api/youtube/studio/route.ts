import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getValidYouTubeAccessToken, type YouTubeConnectionTokenFields } from '@/lib/youtubeAuth'
import { fetchYouTubeStudioCatalog, YouTubeStudioApiError } from '@/lib/youtubeStudioApi'
import {
  emptyYouTubeStudioQueueCounts,
  summarizeYouTubeQueueRows,
  totalYouTubeQueueCounts,
  type YouTubeStudioQueueCountRow,
} from '@/lib/youtubeStudioView'
import {
  persistYouTubeStudioCatalog,
  YouTubeStudioPersistenceError,
} from '@/lib/youtubeStudioPersistence'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const studioSyncs = new Set<string>()
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{1,200}$/

type ConnectionRow = YouTubeConnectionTokenFields & {
  id: string
  channel_id: string
  channel_title: string | null
}

async function ownerConnection() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { user: null, connection: null, error: 'unauthorized' as const }

  const admin = getSupabaseAdmin()
  const { data: connection, error } = await admin
    .from('youtube_connections')
    .select('id, user_id, channel_id, channel_title, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()
  if (error) return { user, connection: null, error: 'lookup_failed' as const }
  return { user, connection, admin, error: null }
}

export async function GET(request: NextRequest) {
  const access = await ownerConnection()
  if (access.error === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.error === 'lookup_failed') {
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!access.connection || !access.admin) {
    return NextResponse.json({ error: 'Connect YouTube before opening the content hub.', connected: false }, { status: 404 })
  }

  const playlistId = request.nextUrl.searchParams.get('playlistId')?.trim() ?? ''
  if (playlistId && !VIDEO_ID_RE.test(playlistId)) {
    return NextResponse.json({ error: 'Invalid YouTube playlist.' }, { status: 400 })
  }
  const search = (request.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100).toLocaleLowerCase()
  const admin = access.admin
  const connectionId = access.connection.id
  const [profileResult, videosResult, playlistsResult, queueResult] = await Promise.all([
    admin.from('youtube_channel_profiles')
      .select('channel_id, title, avatar_url, channel_url, uploads_playlist_id, subscriber_count, subscriber_count_hidden, video_count, view_count, catalog_partial, synced_at')
      .eq('connection_id', connectionId)
      .maybeSingle(),
    admin.from('youtube_videos')
      .select('id, video_id, channel_id, title, description, thumbnail_url, published_at, view_count, comment_count, privacy_status, upload_position, is_available, synced_at')
      .eq('connection_id', connectionId)
      .eq('is_available', true)
      .order('upload_position', { ascending: true, nullsFirst: false })
      .limit(1500),
    admin.from('youtube_playlists')
      .select('id, playlist_id, title, description, thumbnail_url, published_at, item_count, is_active, membership_complete, synced_at')
      .eq('connection_id', connectionId)
      .eq('is_active', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(200),
    admin.from('youtube_comment_queue')
      .select('video_id, processing_state, approval_status, comment_text')
      .eq('connection_id', connectionId)
      .order('comment_published_at', { ascending: false })
      .limit(5000),
  ])

  const schemaError = [profileResult.error, videosResult.error, playlistsResult.error]
    .find(error => error?.code === 'PGRST205' || error?.code === '42P01')
  if (schemaError) {
    return NextResponse.json({ error: 'YouTube Studio catalog migration 030 must be applied before using this hub.' }, { status: 503 })
  }
  const initialError = [profileResult.error, videosResult.error, playlistsResult.error, queueResult.error]
    .find(Boolean)
  if (initialError) {
    console.error('[YouTube Studio] Catalog lookup failed:', initialError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube content catalog.' }, { status: 500 })
  }

  const playlistInternalIds = (playlistsResult.data ?? []).map(playlist => playlist.id as string)
  const membershipsResult = playlistInternalIds.length > 0
    ? await admin.from('youtube_playlist_videos')
      .select('playlist_id, video_id, position')
      .in('playlist_id', playlistInternalIds)
      .order('position', { ascending: true })
      .limit(10000)
    : { data: [], error: null }
  if (membershipsResult.error) {
    const migrationMissing = membershipsResult.error.code === 'PGRST205' || membershipsResult.error.code === '42P01'
    return NextResponse.json({
      error: migrationMissing
        ? 'YouTube Studio catalog migration 030 must be applied before using this hub.'
        : 'Unable to load the YouTube content catalog.',
    }, { status: migrationMissing ? 503 : 500 })
  }

  const queueRows = (queueResult.data ?? []) as YouTubeStudioQueueCountRow[]
  const queueByVideo = summarizeYouTubeQueueRows(queueRows)
  const commentSearchMatches = search
    ? new Set(queueRows.filter(row => row.comment_text?.toLocaleLowerCase().includes(search)).map(row => row.video_id))
    : new Set<string>()
  const videos = (videosResult.data ?? []).map(video => ({
    internalId: video.id,
    videoId: video.video_id,
    title: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail_url,
    publishedAt: video.published_at,
    viewCount: video.view_count,
    commentCount: video.comment_count,
    privacyStatus: video.privacy_status,
    uploadPosition: video.upload_position,
    available: video.is_available,
    syncedAt: video.synced_at,
    queue: queueByVideo.get(video.video_id) ?? emptyYouTubeStudioQueueCounts(),
  }))
  const videosByInternalId = new Map(videos.map(video => [video.internalId, video]))
  const playlistsByInternalId = new Map((playlistsResult.data ?? []).map(playlist => [playlist.id as string, playlist]))
  const membershipByPlaylist = new Map<string, Array<{ videoId: string; position: number }>>()
  for (const membership of membershipsResult.data ?? []) {
    const playlist = playlistsByInternalId.get(membership.playlist_id as string)
    const video = videosByInternalId.get(membership.video_id as string)
    if (!playlist || !video) continue
    const current = membershipByPlaylist.get(playlist.playlist_id as string) ?? []
    current.push({ videoId: video.videoId, position: membership.position as number })
    membershipByPlaylist.set(playlist.playlist_id as string, current)
  }
  const playlists = (playlistsResult.data ?? []).map(playlist => {
    const memberships = membershipByPlaylist.get(playlist.playlist_id) ?? []
    const artwork = playlist.thumbnail_url
      ?? memberships.map(item => videos.find(video => video.videoId === item.videoId)?.thumbnailUrl).find(Boolean)
      ?? null
    return {
      playlistId: playlist.playlist_id,
      title: playlist.title,
      description: playlist.description,
      thumbnailUrl: artwork,
      publishedAt: playlist.published_at,
      itemCount: playlist.item_count,
      ownedVideoCount: memberships.length,
      membershipComplete: playlist.membership_complete,
      syncedAt: playlist.synced_at,
      videoIds: memberships.sort((a, b) => a.position - b.position).map(item => item.videoId),
    }
  })

  const selectedPlaylist = playlistId ? playlists.find(playlist => playlist.playlistId === playlistId) ?? null : null
  const playlistVideoOrder = selectedPlaylist
    ? new Map(selectedPlaylist.videoIds.map((videoId, index) => [videoId, index]))
    : null
  let visibleVideos = selectedPlaylist
    ? videos.filter(video => playlistVideoOrder?.has(video.videoId))
      .sort((a, b) => (playlistVideoOrder?.get(a.videoId) ?? 0) - (playlistVideoOrder?.get(b.videoId) ?? 0))
    : videos
  if (search) {
    visibleVideos = visibleVideos.filter(video => (
      video.title.toLocaleLowerCase().includes(search)
      || commentSearchMatches.has(video.videoId)
    ))
  }

  const profile = profileResult.data
  const syncedAt = profile?.synced_at ?? null
  const needsRefresh = !syncedAt || Date.parse(syncedAt) < Date.now() - 15 * 60 * 1000
  return NextResponse.json({
    connected: true,
    channel: profile ? {
      channelId: profile.channel_id,
      title: profile.title,
      avatarUrl: profile.avatar_url,
      channelUrl: profile.channel_url,
      subscriberCount: profile.subscriber_count,
      subscriberCountHidden: profile.subscriber_count_hidden,
      videoCount: profile.video_count,
      viewCount: profile.view_count,
      syncedAt: profile.synced_at,
      partial: profile.catalog_partial,
    } : {
      channelId: access.connection.channel_id,
      title: access.connection.channel_title ?? 'YouTube channel',
      avatarUrl: null,
      channelUrl: `https://www.youtube.com/channel/${encodeURIComponent(access.connection.channel_id)}`,
      subscriberCount: null,
      subscriberCountHidden: false,
      videoCount: null,
      viewCount: null,
      syncedAt: null,
      partial: false,
    },
    videos: visibleVideos.map(video => {
      const { internalId, ...publicVideo } = video
      void internalId
      return publicVideo
    }),
    allVideoCount: videos.length,
    playlists,
    selectedPlaylist,
    totals: totalYouTubeQueueCounts(queueByVideo.values()),
    queueTruncated: queueRows.length >= 5000,
    needsRefresh,
  })
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const access = await ownerConnection()
  if (access.error === 'unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (access.error === 'lookup_failed') {
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!access.user || !access.connection || !access.admin) {
    return NextResponse.json({ error: 'Connect YouTube before refreshing channel content.' }, { status: 404 })
  }
  if (studioSyncs.has(access.connection.id)) {
    return NextResponse.json({ error: 'Channel content is already refreshing.' }, { status: 409 })
  }

  studioSyncs.add(access.connection.id)
  try {
    const accessToken = await getValidYouTubeAccessToken(access.connection, access.admin)
    if (!accessToken) {
      return NextResponse.json({ error: 'YouTube authorization expired. Reconnect YouTube and try again.' }, { status: 401 })
    }
    const catalog = await fetchYouTubeStudioCatalog({
      accessToken,
      expectedChannelId: access.connection.channel_id,
      signal: AbortSignal.timeout(50_000),
    })
    const saved = await persistYouTubeStudioCatalog({
      admin: access.admin,
      connection: {
        id: access.connection.id,
        userId: access.connection.user_id,
        channelId: access.connection.channel_id,
        channelTitle: access.connection.channel_title,
      },
      catalog,
    })
    return NextResponse.json({
      refreshed: true,
      partial: catalog.partial,
      pagesFetched: catalog.pagesFetched,
      ...saved,
    })
  } catch (error) {
    if (error instanceof YouTubeStudioApiError) {
      const status = error.reason === 'quotaExceeded' || error.reason === 'dailyLimitExceeded'
        ? 429
        : error.status >= 400 && error.status < 500 ? error.status : 502
      return NextResponse.json({ error: error.message, code: error.reason }, { status })
    }
    if (error instanceof YouTubeStudioPersistenceError) {
      return NextResponse.json({ error: error.message }, {
        status: error.code === 'PGRST205' || error.code === '42P01' ? 503 : 500,
      })
    }
    console.error('[YouTube Studio] Refresh failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to refresh YouTube channel content.' }, { status: 502 })
  } finally {
    studioSyncs.delete(access.connection.id)
  }
}
