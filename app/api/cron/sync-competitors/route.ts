import { NextRequest, NextResponse } from 'next/server'
import { batchSyncAllCompetitors } from '@/lib/competitors'
import { isAuthorizedCron } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await batchSyncAllCompetitors()
  return NextResponse.json({ success: true, ...result })
}
