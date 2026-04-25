import { NextRequest, NextResponse } from 'next/server'
import { processReplyQueue } from '@/lib/replyQueue'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
