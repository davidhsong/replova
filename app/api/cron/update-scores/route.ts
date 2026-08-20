import { NextRequest, NextResponse } from 'next/server'
import { batchSaveAllScores } from '@/lib/reputationScore'
import { isAuthorizedCron } from '@/lib/cronAuth'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { updated, errors } = await batchSaveAllScores()

  return NextResponse.json({ updated, errors })
}
