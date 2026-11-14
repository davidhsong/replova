import { NextRequest, NextResponse } from 'next/server'
import { sanitizeKnowledgeInput } from '@/lib/replyKnowledge'
import { ensureYouTubeKnowledgeBase } from '@/lib/youtubeKnowledge'
import { getYouTubeKnowledgeAccess } from '@/lib/youtubeKnowledgeAccess'

type KnowledgeEntryRow = {
  id: string
  entry_type: 'faq' | 'fact' | 'video_context'
  title: string
  content: string
  scope_type: 'general' | 'youtube_video'
  scope_key: string | null
  source_title: string | null
  source_description: string | null
  source_fetched_at: string | null
  created_at: string
  updated_at: string
}

export async function GET() {
  const access = await getYouTubeKnowledgeAccess()
  if (!access.ok) return access.error

  try {
    const base = await ensureYouTubeKnowledgeBase(access.admin, access.connection)
    const { data, error } = await access.admin
      .from('knowledge_entries')
      .select('id, entry_type, title, content, scope_type, scope_key, source_title, source_description, source_fetched_at, created_at, updated_at')
      .eq('knowledge_base_id', base.id)
      .order('created_at', { ascending: true })
    if (error) throw new Error('knowledge_entries_unavailable')

    return NextResponse.json({
      description: base.description,
      responseGuidelines: base.response_guidelines,
      entries: ((data ?? []) as KnowledgeEntryRow[]).map(entry => ({
        id: entry.id,
        type: entry.entry_type,
        title: entry.title,
        content: entry.content,
        scopeType: entry.scope_type,
        scopeKey: entry.scope_key,
        sourceTitle: entry.source_title,
        sourceDescription: entry.source_description,
        sourceFetchedAt: entry.source_fetched_at,
        createdAt: entry.created_at,
        updatedAt: entry.updated_at,
      })),
    })
  } catch (error) {
    console.error('[YouTube knowledge] Load failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to load the Knowledge Base.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const access = await getYouTubeKnowledgeAccess()
  if (!access.ok) return access.error

  let body: { description?: unknown; responseGuidelines?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const description = sanitizeKnowledgeInput(body.description, 4000)
  const responseGuidelines = sanitizeKnowledgeInput(body.responseGuidelines, 3000)
  if (description === null || responseGuidelines === null) {
    return NextResponse.json({ error: 'Description and guidelines must be valid text.' }, { status: 400 })
  }

  try {
    const base = await ensureYouTubeKnowledgeBase(access.admin, access.connection)
    const { error } = await access.admin.from('knowledge_bases').update({
      description,
      response_guidelines: responseGuidelines,
    }).eq('id', base.id).eq('owner_user_id', access.connection.userId)
    if (error) throw new Error('knowledge_base_update_failed')
    return NextResponse.json({ description, responseGuidelines })
  } catch (error) {
    console.error('[YouTube knowledge] Update failed:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'Unable to save the Knowledge Base.' }, { status: 500 })
  }
}
