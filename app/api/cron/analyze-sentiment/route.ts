import { NextRequest, NextResponse } from 'next/server'
import { batchAnalyzePendingReviews } from '@/lib/sentiment'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { processed, errors } = await batchAnalyzePendingReviews()

  return NextResponse.json({ processed, errors })
}
