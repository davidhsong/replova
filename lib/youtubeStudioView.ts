export type YouTubeStudioQueueCounts = {
  syncedComments: number
  needsReview: number
  approved: number
  published: number
  failed: number
  skipped: number
}

export type YouTubeStudioQueueCountRow = {
  video_id: string
  processing_state: string
  approval_status: string
  comment_text?: string
}

export function emptyYouTubeStudioQueueCounts(): YouTubeStudioQueueCounts {
  return { syncedComments: 0, needsReview: 0, approved: 0, published: 0, failed: 0, skipped: 0 }
}

export function summarizeYouTubeQueueRows(
  rows: YouTubeStudioQueueCountRow[]
): Map<string, YouTubeStudioQueueCounts> {
  const summaries = new Map<string, YouTubeStudioQueueCounts>()
  for (const row of rows) {
    const summary = summaries.get(row.video_id) ?? emptyYouTubeStudioQueueCounts()
    summary.syncedComments += 1
    if (row.processing_state === 'awaiting_approval' && row.approval_status === 'pending') {
      summary.needsReview += 1
    }
    if (['ready_to_publish', 'publishing'].includes(row.processing_state) && row.approval_status === 'approved') {
      summary.approved += 1
    }
    if (row.processing_state === 'published') summary.published += 1
    if (['draft_failed', 'publish_failed', 'publish_uncertain'].includes(row.processing_state)) summary.failed += 1
    if (['skipped', 'rejected'].includes(row.processing_state)) summary.skipped += 1
    summaries.set(row.video_id, summary)
  }
  return summaries
}

export function totalYouTubeQueueCounts(
  summaries: Iterable<YouTubeStudioQueueCounts>
): YouTubeStudioQueueCounts {
  const total = emptyYouTubeStudioQueueCounts()
  for (const summary of summaries) {
    total.syncedComments += summary.syncedComments
    total.needsReview += summary.needsReview
    total.approved += summary.approved
    total.published += summary.published
    total.failed += summary.failed
    total.skipped += summary.skipped
  }
  return total
}
