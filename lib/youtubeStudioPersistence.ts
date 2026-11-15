import 'server-only'

import pLimit from 'p-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { persistYouTubeVideoMetadata, type YouTubeKnowledgeConnection } from './youtubeKnowledge'
import type { YouTubeStudioCatalog } from './youtubeStudioApi'

export class YouTubeStudioPersistenceError extends Error {
  constructor(public readonly code: string) {
    super(code === 'PGRST205' || code === '42P01'
      ? 'YouTube Studio catalog migration 030 has not been applied.'
      : 'Unable to save the YouTube content catalog.')
    this.name = 'YouTubeStudioPersistenceError'
  }
}

export async function persistYouTubeStudioCatalog({
  admin,
  connection,
  catalog,
}: {
  admin: SupabaseClient
  connection: YouTubeKnowledgeConnection
  catalog: YouTubeStudioCatalog
}): Promise<{ videos: number; playlists: number; memberships: number; knowledgeVideos: number }> {
  const syncedAt = new Date().toISOString()
  const { error: profileError } = await admin.from('youtube_channel_profiles').upsert({
    connection_id: connection.id,
    channel_id: catalog.channel.channelId,
    title: catalog.channel.title,
    avatar_url: catalog.channel.avatarUrl,
    channel_url: catalog.channel.channelUrl,
    uploads_playlist_id: catalog.channel.uploadsPlaylistId,
    subscriber_count: catalog.channel.subscriberCount,
    subscriber_count_hidden: catalog.channel.subscriberCountHidden,
    video_count: catalog.channel.videoCount,
    view_count: catalog.channel.viewCount,
    catalog_partial: catalog.partial,
    synced_at: syncedAt,
    updated_at: syncedAt,
  }, { onConflict: 'connection_id' })
  if (profileError) throw new YouTubeStudioPersistenceError(profileError.code)

  if (catalog.videos.length > 0) {
    const { error } = await admin.from('youtube_videos').upsert(
      catalog.videos.map(video => ({
        connection_id: connection.id,
        video_id: video.videoId,
        channel_id: video.channelId,
        title: video.title,
        description: video.description,
        thumbnail_url: video.thumbnailUrl,
        published_at: video.publishedAt,
        view_count: video.viewCount,
        comment_count: video.commentCount,
        privacy_status: video.privacyStatus,
        upload_position: video.uploadPosition,
        is_available: true,
        synced_at: syncedAt,
        updated_at: syncedAt,
      })),
      { onConflict: 'connection_id,video_id' }
    )
    if (error) throw new YouTubeStudioPersistenceError(error.code)
  }

  if (catalog.playlists.length > 0) {
    const { error } = await admin.from('youtube_playlists').upsert(
      catalog.playlists.map(playlist => ({
        connection_id: connection.id,
        playlist_id: playlist.playlistId,
        channel_id: playlist.channelId,
        title: playlist.title,
        description: playlist.description,
        thumbnail_url: playlist.thumbnailUrl,
        published_at: playlist.publishedAt,
        item_count: playlist.itemCount,
        is_active: true,
        synced_at: syncedAt,
        updated_at: syncedAt,
      })),
      { onConflict: 'connection_id,playlist_id' }
    )
    if (error) throw new YouTubeStudioPersistenceError(error.code)
  }

  if (catalog.uploadsComplete) {
    let staleVideos = admin.from('youtube_videos')
      .update({ is_available: false, updated_at: syncedAt })
      .eq('connection_id', connection.id)
    if (catalog.videos.length > 0) {
      const currentVideoIds = `(${catalog.videos.map(video => `"${video.videoId}"`).join(',')})`
      staleVideos = staleVideos.not('video_id', 'in', currentVideoIds)
    }
    const { error } = await staleVideos
    if (error) throw new YouTubeStudioPersistenceError(error.code)
  }

  if (catalog.playlistsComplete) {
    let stalePlaylists = admin.from('youtube_playlists')
      .update({ is_active: false, updated_at: syncedAt })
      .eq('connection_id', connection.id)
    if (catalog.playlists.length > 0) {
      const currentPlaylistIds = `(${catalog.playlists.map(playlist => `"${playlist.playlistId}"`).join(',')})`
      stalePlaylists = stalePlaylists.not('playlist_id', 'in', currentPlaylistIds)
    }
    const { error } = await stalePlaylists
    if (error) throw new YouTubeStudioPersistenceError(error.code)
  }

  let memberships = 0
  const membershipLimit = pLimit(4)
  const membershipResults = await Promise.all(catalog.playlists.map(playlist => membershipLimit(async () => {
    const { data, error } = await admin.rpc('replace_youtube_playlist_memberships', {
      p_connection_id: connection.id,
      p_playlist_external_id: playlist.playlistId,
      p_memberships: playlist.memberships.map(item => ({
        video_id: item.videoId,
        position: item.position,
      })),
      p_membership_complete: playlist.membershipComplete,
      p_refreshed_at: syncedAt,
    })
    if (error) throw new YouTubeStudioPersistenceError(error.code)
    return typeof data === 'number' ? data : Number(data ?? 0)
  })))
  memberships = membershipResults.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)

  let knowledgeVideos = 0
  try {
    await persistYouTubeVideoMetadata({
      admin,
      connection,
      videos: catalog.videos.map(video => ({
        videoId: video.videoId,
        title: video.title,
        description: video.description,
      })),
    })
    knowledgeVideos = catalog.videos.length
  } catch (error) {
    console.error('[YouTube Studio] Video knowledge refresh failed:', error instanceof Error ? error.name : 'UnknownError')
  }

  return {
    videos: catalog.videos.length,
    playlists: catalog.playlists.length,
    memberships,
    knowledgeVideos,
  }
}
