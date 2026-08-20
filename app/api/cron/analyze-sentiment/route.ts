import { NextRequest, NextResponse } from 'next/server'
import { batchAnalyzePendingReviews } from '@/lib/sentiment'
import { isAuthorizedCron } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { processed, errors } = await batchAnalyzePendingReviews()

  return NextResponse.json({ processed, errors })
}
