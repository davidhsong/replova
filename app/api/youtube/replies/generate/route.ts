import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generateYouTubeReply } from '@/lib/generateYouTubeReply'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 60 * 1000
const COMMENT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/
const generationInFlight = new Set<string>()

type GenerateBody = {
  commentId?: unknown
  author?: unknown
  text?: unknown
  previousDraft?: unknown
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: GenerateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const commentId = typeof body.commentId === 'string' ? body.commentId.trim() : ''
  const author = typeof body.author === 'string' ? body.author.trim() : ''
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const previousDraft = typeof body.previousDraft === 'string' ? body.previousDraft.trim() : ''

  if (!COMMENT_ID_RE.test(commentId)) {
    return NextResponse.json({ error: 'A valid YouTube comment ID is required.' }, { status: 400 })
  }
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: 'Comment text must be between 1 and 2,000 characters.' }, { status: 400 })
  }
  if (author.length > 100) {
    return NextResponse.json({ error: 'Comment author is too long.' }, { status: 400 })
  }
  if (body.previousDraft !== undefined && typeof body.previousDraft !== 'string') {
    return NextResponse.json({ error: 'Previous draft must be text.' }, { status: 400 })
  }
  if (previousDraft.length > 1000) {
    return NextResponse.json({ error: 'Previous draft is too long.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('channel_title')
    .eq('user_id', user.id)
    .maybeSingle<{ channel_title: string | null }>()

  if (connectionError) {
    console.error('[YouTube AI reply] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before generating replies.' }, { status: 404 })
  }

  // Keep user identity server-derived and pseudonymous in the existing usage log.
  const userBucket = createHash('sha256').update(user.id).digest('hex').slice(0, 20)
  const usageOperation = `youtube_reply_draft:${userBucket}`
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
  const { count, error: rateError } = await admin
    .from('api_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('operation', usageOperation)
    .gte('created_at', windowStart)

  if (rateError) {
    console.error('[YouTube AI reply] Rate-limit lookup failed:', rateError.code)
    return NextResponse.json({ error: 'Reply generation is temporarily unavailable.' }, { status: 503 })
  }
  if ((count ?? 0) >= RATE_LIMIT) {
    return NextResponse.json(
      { error: 'You have reached the AI reply limit. Try again in about an hour.' },
      { status: 429 }
    )
  }
  if (generationInFlight.has(userBucket)) {
    return NextResponse.json({ error: 'A reply is already being generated. Please wait.' }, { status: 429 })
  }

  generationInFlight.add(userBucket)
  try {
    const reply = await generateYouTubeReply({
      channelTitle: connection.channel_title ?? 'your YouTube channel',
      author: author || 'Viewer',
      commentText: text,
      previousDraft: previousDraft || undefined,
      usageOperation,
    })
    return NextResponse.json({ reply })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null
    console.error('[YouTube AI reply] Generation failed:', error instanceof Error ? error.name : 'Unknown error')
    if (status === 429) {
      return NextResponse.json({ error: 'The AI service is busy. Try again shortly.' }, { status: 429 })
    }
    return NextResponse.json({ error: 'Unable to generate a reply right now.' }, { status: 502 })
  } finally {
    generationInFlight.delete(userBucket)
  }
}
