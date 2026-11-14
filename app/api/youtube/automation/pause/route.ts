import { NextRequest, NextResponse } from 'next/server'
import { getYouTubeAutomationAccess, mutationGuard } from '@/lib/youtubeAutomationControls'

export async function POST(request: NextRequest) {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  const guard = mutationGuard(request, access.userId)
  if (guard) return guard
  let body: { paused?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'Paused must be true or false.' }, { status: 400 })
  }
  const { error } = await access.admin.rpc('set_youtube_automation_emergency_pause', {
    p_connection_id: access.connection.id,
    p_owner_id: access.userId,
    p_paused: body.paused,
  })
  if (error) {
    console.error('[YouTube automation pause] Change failed:', error.code)
    return NextResponse.json({ error: 'Unable to update the emergency pause.' }, { status: 500 })
  }
  return NextResponse.json({ emergencyPaused: body.paused, runtimeEnabled: false })
}
