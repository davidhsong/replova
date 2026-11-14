import { NextRequest, NextResponse } from 'next/server'
import { sanitizeKnowledgeInput, type KnowledgeEntryType } from '@/lib/replyKnowledge'
import { ensureYouTubeKnowledgeBase } from '@/lib/youtubeKnowledge'
import { getYouTubeKnowledgeAccess } from '@/lib/youtubeKnowledgeAccess'

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{1,200}$/

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const access = await getYouTubeKnowledgeAccess()
  if (!access.ok) return access.error

  let body: { type?: unknown; title?: unknown; content?: unknown; videoId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const type = body.type === 'faq' || body.type === 'fact' || body.type === 'video_context'
    ? body.type as KnowledgeEntryType
    : null
  if (!type) return NextResponse.json({ error: 'Choose a valid knowledge item type.' }, { status: 400 })

  const titleLimit = type === 'fact' ? 200 : 500
  const title = sanitizeKnowledgeInput(body.title, titleLimit, type !== 'video_context')
  const content = sanitizeKnowledgeInput(body.content, type === 'video_context' ? 3000 : 2000, type !== 'video_context')
  const videoId = sanitizeKnowledgeInput(body.videoId, 200, type === 'video_context')
  if (title === null || content === null || (type === 'video_context' && (!videoId || !VIDEO_ID_RE.test(videoId)))) {
    return NextResponse.json({ error: 'Knowledge item fields are invalid or too long.' }, { status: 400 })
  }

  try {
    const base = await ensureYouTubeKnowledgeBase(access.admin, access.connection)
    const { count, error: countError } = await access.admin.from('knowledge_entries')
      .select('*', { count: 'exact', head: true })
      .eq('knowledge_base_id', base.id)
    if (countError) throw new Error('knowledge_entry_count_failed')
    if ((count ?? 0) >= 100) {
      return NextResponse.json({ error: 'The Knowledge Base supports up to 100 items.' }, { status: 409 })
    }

    if (type === 'video_context') {
      const { data: duplicate } = await access.admin.from('knowledge_entries')
        .select('id')
        .eq('knowledge_base_id', base.id)
        .eq('entry_type', 'video_context')
        .eq('scope_key', videoId)
        .maybeSingle()
      if (duplicate) {
        return NextResponse.json({ error: 'Context for this video already exists.' }, { status: 409 })
      }
    }

    const { data, error } = await access.admin.from('knowledge_entries').insert({
      knowledge_base_id: base.id,
      owner_user_id: access.connection.userId,
      entry_type: type,
      title: type === 'video_context' ? videoId : title,
      content,
      scope_type: type === 'video_context' ? 'youtube_video' : 'general',
      scope_key: type === 'video_context' ? videoId : null,
    }).select('id').single<{ id: string }>()
    if (error?.code === '23505') {
      return NextResponse.json({
        error: type === 'video_context'
          ? 'Context for this video already exists.'
          : 'An item with this question or subject already exists.',
      }, { status: 409 })
    }
    if (error || !data) throw new Error('knowledge_entry_create_failed')
    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('[YouTube knowledge] Create failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to create the knowledge item.' }, { status: 500 })
  }
}
