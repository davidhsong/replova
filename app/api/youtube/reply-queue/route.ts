import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isYouTubeQueueFilter } from '@/lib/youtubeQueuePolicy'
import { createClient } from '@/utils/supabase/server'

const PAGE_SIZE = 30
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{1,200}$/

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
  const videoId = request.nextUrl.searchParams.get('videoId')?.trim() ?? ''
  if (videoId && !VIDEO_ID_RE.test(videoId)) {
    return NextResponse.json({ error: 'Invalid YouTube video.' }, { status: 400 })
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
    .select('id, youtube_comment_id, video_id, author_display_name, comment_text, comment_published_at, category, category_confidence, processing_state, approval_status, generated_reply, edited_reply, published_reply_id, published_reply_url, published_at, publish_result_uncertain, reply_verification_status, reply_verification_error, requires_manual_review, manual_review_reason, knowledge_entry_ids, knowledge_context_used_at, last_error_message, updated_at')
    .eq('connection_id', connection.id)

  if (videoId) query = query.eq('video_id', videoId)

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
  const [queueResult, videoResult] = await Promise.all([
    query.order('comment_published_at', { ascending: false }).range(from, from + PAGE_SIZE),
    videoId
      ? admin.from('youtube_videos')
        .select('video_id, title, thumbnail_url, published_at, view_count, comment_count, privacy_status')
        .eq('connection_id', connection.id)
        .eq('video_id', videoId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const { data, error } = queueResult
  if (error) {
    console.error('[YouTube queue] Queue lookup failed:', error.code)
    return NextResponse.json({ error: 'Unable to load the YouTube Reply Queue.' }, { status: 500 })
  }
  if (videoResult.error) {
    const missingSchema = videoResult.error.code === 'PGRST205' || videoResult.error.code === '42P01'
    return NextResponse.json({
      error: missingSchema
        ? 'YouTube Studio catalog migration 030 must be applied before opening a video.'
        : 'Unable to load this YouTube video.',
    }, { status: missingSchema ? 503 : 500 })
  }
  if (videoId && !videoResult.data) {
    return NextResponse.json({ error: 'This video is not in the connected channel catalog.' }, { status: 404 })
  }

  const rows = data ?? []
  return NextResponse.json({
    channelTitle: connection.channel_title,
    video: videoResult.data ? {
      videoId: videoResult.data.video_id,
      title: videoResult.data.title,
      thumbnailUrl: videoResult.data.thumbnail_url,
      publishedAt: videoResult.data.published_at,
      viewCount: videoResult.data.view_count,
      commentCount: videoResult.data.comment_count,
      privacyStatus: videoResult.data.privacy_status,
    } : null,
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
      replyVerificationError: item.reply_verification_error,
      requiresManualReview: item.requires_manual_review,
      manualReviewReason: item.manual_review_reason,
      knowledgeGrounded: item.knowledge_context_used_at !== null,
      knowledgeEntryCount: item.knowledge_entry_ids?.length ?? 0,
      lastError: item.last_error_message,
      updatedAt: item.updated_at,
    })),
    page: pageValue,
    hasMore: rows.length > PAGE_SIZE,
  })
}
