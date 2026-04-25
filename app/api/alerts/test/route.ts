import { NextRequest, NextResponse } from 'next/server'
import { sendNegativeReviewAlert } from '@/lib/alerts'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { reviewId } = await req.json()
  if (!reviewId || typeof reviewId !== 'string') {
    return NextResponse.json({ error: 'reviewId is required' }, { status: 400 })
  }

  await sendNegativeReviewAlert(reviewId)
  return NextResponse.json({ success: true })
}
