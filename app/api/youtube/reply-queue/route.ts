import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isYouTubeQueueFilter } from '@/lib/youtubeQueuePolicy'
import { createClient } from '@/utils/supabase/server'

const PAGE_SIZE = 30

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const filterValue = request.nextUrl.searchParams.get('filter') ?? 'needs_review'
  if (!isYouTubeQueueFilter(filterValue)) {
    return NextResponse.json({ error: 'Invalid queue filter.' }, { status: 400 })
  }
  const pageValue = Number(request.nextUrl.searchParams.get('page') ?? '0')
  if (!Number.isInteger(pageValue) || pageValue < 0 || pageValue > 1000) {
    return NextResponse.json({ error: 'Invalid page.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error: connectionError } = await admin
    .from('youtube_connections')
    .select('id, channel_title')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; channel_title: string | null }>()
  if (connectionError) {
    console.error('[YouTube queue] Connection lookup failed:', connectionError.code)
    return NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 })
  }
  if (!connection) {
    return NextResponse.json({ error: 'Connect YouTube before opening the Reply Queue.' }, { status: 404 })
  }

  let query = admin
    .from('youtube_comment_queue')
    .select('id, youtube_comment_id, video_id, author_display_name, comment_text, comment_published_at, category, category_confidence, processing_state, approval_status, generated_reply, edited_reply, published_reply_id, published_reply_url, published_at, publish_result_uncertain, reply_verification_status, requires_manual_review, manual_review_reason, last_error_message, updated_at')
    .eq('connection_id', connection.id)

  if (filterValue === 'needs_review') {
    query = query.eq('processing_state', 'awaiting_approval').eq('approval_status', 'pending')
  } else if (filterValue === 'approved') {
    query = query.in('processing_state', ['ready_to_publish', 'publishing']).eq('approval_status', 'approved')
  } else if (filterValue === 'published') {
    query = query.eq('processing_state', 'published')
  } else if (filterValue === 'skipped') {
    query = query.in('processing_state', ['skipped', 'rejected'])
  } else {
    query = query.in('processing_state', ['draft_failed', 'publish_failed', 'publish_uncertain'])
  }

  const from = pageValue * PAGE_SIZE
  const { data, error } = await query
    .order('comment_published_at', { ascending: false })
    .range(from, from + PAGE_SIZE)
  if (error) {
    console.error('[YouTube queue] Queue lookup failed:', error.code)
    return NextResponse.json({ error: 'Unable to load the YouTube Reply Queue.' }, { status: 500 })
  }

  const rows = data ?? []
  return NextResponse.json({
    channelTitle: connection.channel_title,
    items: rows.slice(0, PAGE_SIZE).map(item => ({
      id: item.id,
      youtubeCommentId: item.youtube_comment_id,
      videoId: item.video_id,
      author: item.author_display_name ?? 'Unknown author',
      comment: item.comment_text,
      commentPublishedAt: item.comment_published_at,
      category: item.category,
      confidence: item.category_confidence,
      processingState: item.processing_state,
      approvalStatus: item.approval_status,
      draft: item.edited_reply ?? item.generated_reply,
      generatedDraft: item.generated_reply,
      hasManualEdit: item.edited_reply !== null,
      publishedReplyId: item.published_reply_id,
      publishedReplyUrl: item.published_reply_url,
      publishedAt: item.published_at,
      publishResultUncertain: item.publish_result_uncertain,
      replyVerificationStatus: item.reply_verification_status,
      requiresManualReview: item.requires_manual_review,
      manualReviewReason: item.manual_review_reason,
      lastError: item.last_error_message,
      updatedAt: item.updated_at,
    })),
    page: pageValue,
    hasMore: rows.length > PAGE_SIZE,
  })
}
