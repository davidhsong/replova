import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getValidYouTubeAccessToken,
  type YouTubeConnectionTokenFields,
} from '@/lib/youtubeAuth'
import { verifyAndPublishYouTubeReply } from '@/lib/youtubePublishing'
import { createClient } from '@/utils/supabase/server'

const COMMENT_ID_RE = /^[A-Za-z0-9_-]{1,200}$/
const publishInFlight = new Set<string>()
const publishedThisProcess = new Set<string>()
const uncertainThisProcess = new Set<string>()

type YouTubeConnectionRow = YouTubeConnectionTokenFields & {
  channel_id: string
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { commentId?: unknown; threadId?: unknown; replyText?: unknown; confirmed?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const commentId = typeof body.commentId === 'string' ? body.commentId.trim() : ''
  const threadId = typeof body.threadId === 'string' ? body.threadId.trim() : ''
  const replyText = typeof body.replyText === 'string' ? body.replyText.trim() : ''
  if (!COMMENT_ID_RE.test(commentId) || !COMMENT_ID_RE.test(threadId)) {
    return NextResponse.json({ error: 'Valid YouTube comment identifiers are required.' }, { status: 400 })
  }
  if (!replyText || replyText.length > 1000) {
    return NextResponse.json({ error: 'Reply text must be between 1 and 1,000 characters.' }, { status: 400 })
  }
  if (body.confirmed !== true) {
    return NextResponse.json({ error: 'Explicit publishing confirmation is required.' }, { status: 400 })
  }

  const requestKey = `${user.id}:${commentId}`
  if (publishInFlight.has(requestKey)) {
    return NextResponse.json({ error: 'This reply is already being published.' }, { status: 409 })
  }
  if (publishedThisProcess.has(requestKey)) {
    return NextResponse.json({ error: 'A reply was already published to this comment.', blocked: true }, { status: 409 })
  }
  if (uncertainThisProcess.has(requestKey)) {
    return NextResponse.json(
      { error: 'The previous publish result was uncertain. Check YouTube before trying again.', uncertain: true, blocked: true },
      { status: 409 }
    )
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('user_id, channel_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle<YouTubeConnectionRow>()

  if (connectionError) {
    console.error('[YouTube publish] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) return NextResponse.json({ error: 'Connect YouTube before publishing replies.' }, { status: 404 })

  let accessToken: string | null
  try {
    accessToken = await getValidYouTubeAccessToken(connection, admin)
  } catch {
    return NextResponse.json({ error: 'YouTube authorization could not be refreshed. Try again.' }, { status: 502 })
  }
  if (!accessToken) {
    return NextResponse.json({ error: 'YouTube authorization expired. Reconnect YouTube and try again.' }, { status: 401 })
  }

  publishInFlight.add(requestKey)
  try {
    const outcome = await verifyAndPublishYouTubeReply({
      accessToken,
      channelId: connection.channel_id,
      commentId,
      threadId,
      replyText,
    })

    if (outcome.status === 'failed') {
      if (outcome.uncertain) uncertainThisProcess.add(requestKey)
      return NextResponse.json({
        error: outcome.message,
        ...(outcome.uncertain ? { uncertain: true } : {}),
        ...(outcome.blocked ? { blocked: true } : {}),
      }, { status: outcome.httpStatus })
    }
    if (outcome.status === 'already_published') {
      publishedThisProcess.add(requestKey)
      return NextResponse.json({ error: 'Your channel has already replied to this comment.', blocked: true }, { status: 409 })
    }

    publishedThisProcess.add(requestKey)
    return NextResponse.json({
      published: true,
      replyId: outcome.replyId,
      replyUrl: outcome.replyUrl,
    })
  } finally {
    publishInFlight.delete(requestKey)
  }
}
