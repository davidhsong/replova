import { NextRequest, NextResponse } from 'next/server'
import { processReplyQueue } from '@/lib/replyQueue'
import { isAuthorizedCron } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processReplyQueue()
    return NextResponse.json(result)
  } catch (err) {
    console.error('processReplyQueue fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
