import { NextRequest, NextResponse } from 'next/server'
import { batchSyncAllCompetitors } from '@/lib/competitors'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await batchSyncAllCompetitors()
  return NextResponse.json({ success: true, ...result })
}
