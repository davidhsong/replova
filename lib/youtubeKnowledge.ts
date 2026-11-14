import 'server-only'

import pLimit from 'p-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReplyKnowledgeBase, ReplyKnowledgeEntry } from './replyKnowledge'

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3'

export type YouTubeKnowledgeConnection = {
  id: string
  userId: string
  channelId: string
  channelTitle: string | null
}

type KnowledgeBaseRow = {
  id: string
  owner_user_id: string
  description: string
  response_guidelines: string
}

type KnowledgeEntryRow = {
  id: string
  entry_type: 'faq' | 'fact' | 'video_context'
  title: string
  content: string
  scope_type: 'general' | 'youtube_video'
  scope_key: string | null
  source_title: string | null
  source_description: string | null
}

export async function ensureYouTubeKnowledgeBase(
  admin: SupabaseClient,
  connection: YouTubeKnowledgeConnection
): Promise<KnowledgeBaseRow> {
  const { data, error } = await admin
    .from('knowledge_bases')
    .upsert({
      owner_user_id: connection.userId,
      provider: 'youtube',
      provider_connection_id: connection.id,
      display_name: connection.channelTitle,
    }, { onConflict: 'provider,provider_connection_id' })
    .select('id, owner_user_id, description, response_guidelines')
    .single<KnowledgeBaseRow>()
  if (error || !data) throw new Error('knowledge_base_unavailable')
  return data
}

export async function loadYouTubeReplyKnowledge(
  admin: SupabaseClient,
  connection: YouTubeKnowledgeConnection
): Promise<ReplyKnowledgeBase> {
  const base = await ensureYouTubeKnowledgeBase(admin, connection)
  const { data, error } = await admin
    .from('knowledge_entries')
    .select('id, entry_type, title, content, scope_type, scope_key, source_title, source_description')
    .eq('knowledge_base_id', base.id)
    .order('created_at', { ascending: true })
  if (error) throw new Error('knowledge_entries_unavailable')

  return {
    description: base.description,
    responseGuidelines: base.response_guidelines,
    entries: (data ?? []).map((row: KnowledgeEntryRow): ReplyKnowledgeEntry => ({
      id: row.id,
      entryType: row.entry_type,
      title: row.title,
      content: row.content,
      scopeType: row.scope_type,
      scopeKey: row.scope_key,
      sourceTitle: row.source_title,
      sourceDescription: row.source_description,
    })),
  }
}

type VideoMetadata = { videoId: string; title: string; description: string }

export async function fetchYouTubeVideoMetadata({
  accessToken,
  channelId,
  videoIds,
  signal,
}: {
  accessToken: string
  channelId: string
  videoIds: string[]
  signal?: AbortSignal
}): Promise<VideoMetadata[]> {
  const uniqueIds = [...new Set(videoIds.filter(id => /^[A-Za-z0-9_-]{1,200}$/.test(id)))].slice(0, 50)
  if (uniqueIds.length === 0) return []
  const params = new URLSearchParams({ part: 'snippet', id: uniqueIds.join(','), maxResults: '50' })
  const response = await fetch(`${YOUTUBE_API}/videos?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) return []
  const data = await response.json().catch(() => ({})) as {
    items?: Array<{ id?: string; snippet?: { channelId?: string; title?: string; description?: string } }>
  }
  return (data.items ?? []).flatMap(item => {
    if (!item.id || item.snippet?.channelId !== channelId || !item.snippet.title) return []
    return [{
      videoId: item.id,
      title: item.snippet.title.slice(0, 300),
      description: (item.snippet.description ?? '').slice(0, 5000),
    }]
  })
}

export async function persistYouTubeVideoMetadata({
  admin,
  connection,
  videos,
}: {
  admin: SupabaseClient
  connection: YouTubeKnowledgeConnection
  videos: VideoMetadata[]
}): Promise<void> {
  if (videos.length === 0) return
  const base = await ensureYouTubeKnowledgeBase(admin, connection)
  const videoIds = videos.map(video => video.videoId)
  const { data: existing, error: existingError } = await admin
    .from('knowledge_entries')
    .select('id, scope_key')
    .eq('knowledge_base_id', base.id)
    .eq('entry_type', 'video_context')
    .in('scope_key', videoIds)
  if (existingError) throw new Error('video_context_lookup_failed')
  const existingByVideo = new Map((existing ?? []).map(row => [row.scope_key as string, row.id as string]))
  const limit = pLimit(5)
  const results = await Promise.all(videos.map(video => limit(async () => {
    const existingId = existingByVideo.get(video.videoId)
    if (existingId) {
      return admin.from('knowledge_entries').update({
        title: video.title,
        source_title: video.title,
        source_description: video.description,
        source_fetched_at: new Date().toISOString(),
      }).eq('id', existingId).eq('knowledge_base_id', base.id)
    }
    return admin.from('knowledge_entries').insert({
      knowledge_base_id: base.id,
      owner_user_id: connection.userId,
      entry_type: 'video_context',
      title: video.title,
      content: '',
      scope_type: 'youtube_video',
      scope_key: video.videoId,
      source_title: video.title,
      source_description: video.description,
      source_fetched_at: new Date().toISOString(),
    })
  })))
  if (results.some(result => result.error)) throw new Error('video_context_save_failed')
}

export async function refreshYouTubeVideoMetadata({
  admin,
  connection,
  accessToken,
  videoIds,
  signal,
}: {
  admin: SupabaseClient
  connection: YouTubeKnowledgeConnection
  accessToken: string
  videoIds: string[]
  signal?: AbortSignal
}): Promise<number> {
  const uniqueIds = [...new Set(videoIds)].slice(0, 50)
  if (uniqueIds.length === 0) return 0
  const base = await ensureYouTubeKnowledgeBase(admin, connection)
  const { data, error } = await admin.from('knowledge_entries')
    .select('scope_key, source_fetched_at')
    .eq('knowledge_base_id', base.id)
    .eq('entry_type', 'video_context')
    .in('scope_key', uniqueIds)
  if (error) throw new Error('video_context_lookup_failed')
  const freshnessCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const fresh = new Set((data ?? []).flatMap(row => {
    const fetchedAt = typeof row.source_fetched_at === 'string' ? Date.parse(row.source_fetched_at) : 0
    return row.scope_key && fetchedAt >= freshnessCutoff ? [row.scope_key as string] : []
  }))
  const staleIds = uniqueIds.filter(id => !fresh.has(id))
  if (staleIds.length === 0) return 0

  const videos = await fetchYouTubeVideoMetadata({
    accessToken,
    channelId: connection.channelId,
    videoIds: staleIds,
    signal,
  })
  await persistYouTubeVideoMetadata({ admin, connection, videos })
  return videos.length
}
