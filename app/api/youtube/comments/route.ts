import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getValidYouTubeAccessToken,
  type YouTubeConnectionTokenFields,
} from '@/lib/youtubeAuth'
import { createClient } from '@/utils/supabase/server'
import { fetchYouTubeCommentsPage, YouTubeCommentsError } from '@/lib/youtubeComments'

type YouTubeConnectionRow = YouTubeConnectionTokenFields & {
  channel_id: string
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pageToken = request.nextUrl.searchParams.get('pageToken')
  if (pageToken && pageToken.length > 1000) {
    return NextResponse.json({ error: 'Invalid pagination token.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('user_id, channel_id, access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', user.id)
    .maybeSingle<YouTubeConnectionRow>()

  if (connectionError) {
    console.error('[YouTube comments] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before fetching comments.' }, { status: 404 })
  }

  const accessToken = await getValidYouTubeAccessToken(connection, admin)
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Your YouTube authorization expired. Reconnect YouTube and try again.' },
      { status: 401 }
    )
  }

  try {
    const page = await fetchYouTubeCommentsPage({
      accessToken,
      channelId: connection.channel_id,
      pageToken: pageToken ?? undefined,
      maxResults: 20,
    })
    return NextResponse.json({
      comments: page.comments.map(comment => ({
        id: comment.id,
        threadId: comment.threadId,
        videoId: comment.videoId,
        author: comment.author,
        text: comment.text,
        date: comment.date,
        replyCount: comment.replyCount,
        published: comment.replyStatus.status === 'unknown' ? null : comment.replyStatus.status === 'published',
        publishedReplyId: comment.publishedReplyId,
        publishedReplyUrl: comment.publishedReplyUrl,
      })),
      nextPageToken: page.nextPageToken,
      replyVerificationWarning: page.replyVerificationWarning,
    })
  } catch (error) {
    if (error instanceof YouTubeCommentsError) {
      console.error(`[YouTube comments] API request failed (${error.status}, ${error.reason})`)
      const status = error.reason === 'quotaExceeded' || error.reason === 'dailyLimitExceeded'
        ? 429
        : error.status >= 400 && error.status < 500 ? error.status : 502
      return NextResponse.json({ error: error.message }, { status })
    }
    console.error('[YouTube comments] Unexpected fetch failure')
    return NextResponse.json({ error: 'YouTube comments are temporarily unavailable.' }, { status: 502 })
  }
}
