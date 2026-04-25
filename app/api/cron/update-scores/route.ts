import { NextRequest, NextResponse } from 'next/server'
import { batchSaveAllScores } from '@/lib/reputationScore'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updated, errors } = await batchSaveAllScores()

  return NextResponse.json({ updated, errors })
}
