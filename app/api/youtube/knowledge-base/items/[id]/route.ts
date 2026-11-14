import { NextRequest, NextResponse } from 'next/server'
import { sanitizeKnowledgeInput } from '@/lib/replyKnowledge'
import { ensureYouTubeKnowledgeBase } from '@/lib/youtubeKnowledge'
import { getYouTubeKnowledgeAccess } from '@/lib/youtubeKnowledgeAccess'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function ownedItem(id: string) {
  const access = await getYouTubeKnowledgeAccess()
  if (!access.ok) return { ok: false as const, error: access.error }
  let base
  try {
    base = await ensureYouTubeKnowledgeBase(access.admin, access.connection)
  } catch {
    return { ok: false as const, error: NextResponse.json({ error: 'Unable to load the Knowledge Base.' }, { status: 500 }) }
  }
  const { data, error } = await access.admin.from('knowledge_entries')
    .select('id, entry_type, knowledge_base_id')
    .eq('id', id)
    .eq('knowledge_base_id', base.id)
    .maybeSingle<{ id: string; entry_type: 'faq' | 'fact' | 'video_context'; knowledge_base_id: string }>()
  if (error) return { ok: false as const, error: NextResponse.json({ error: 'Unable to load the knowledge item.' }, { status: 500 }) }
  if (!data) return { ok: false as const, error: NextResponse.json({ error: 'Knowledge item not found.' }, { status: 404 }) }
  return { ok: true as const, admin: access.admin, connection: access.connection, base, item: data }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const { id } = await context.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid knowledge item.' }, { status: 400 })
  const access = await ownedItem(id)
  if (!access.ok) return access.error

  let body: { title?: unknown; content?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const title = access.item.entry_type === 'video_context'
    ? null
    : sanitizeKnowledgeInput(body.title, access.item.entry_type === 'fact' ? 200 : 500, true)
  const content = sanitizeKnowledgeInput(
    body.content,
    access.item.entry_type === 'video_context' ? 3000 : 2000,
    access.item.entry_type !== 'video_context'
  )
  if (content === null || (access.item.entry_type !== 'video_context' && title === null)) {
    return NextResponse.json({ error: 'Knowledge item fields are invalid or too long.' }, { status: 400 })
  }

  const { error } = await access.admin.from('knowledge_entries').update({
    ...(title === null ? {} : { title }),
    content,
  }).eq('id', access.item.id).eq('knowledge_base_id', access.base.id)
  if (error?.code === '23505') {
    return NextResponse.json({ error: 'An item with this question or subject already exists.' }, { status: 409 })
  }
  if (error) {
    console.error('[YouTube knowledge] Item update failed:', error.code)
    return NextResponse.json({ error: 'Unable to save the knowledge item.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  const { id } = await context.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid knowledge item.' }, { status: 400 })
  const access = await ownedItem(id)
  if (!access.ok) return access.error

  const { error } = await access.admin.from('knowledge_entries')
    .delete()
    .eq('id', access.item.id)
    .eq('knowledge_base_id', access.base.id)
  if (error) {
    console.error('[YouTube knowledge] Item delete failed:', error.code)
    return NextResponse.json({ error: 'Unable to delete the knowledge item.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
