import { NextRequest, NextResponse } from 'next/server'
import { YOUTUBE_AUTO_PUBLISH_CONSENT_VERSION } from '@/lib/youtubeAutoPublishPolicy'
import { getYouTubeAutomationAccess, mutationGuard } from '@/lib/youtubeAutomationControls'

export async function GET() {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  return NextResponse.json({
    version: YOUTUBE_AUTO_PUBLISH_CONSENT_VERSION,
    disclosure: {
      publishesPublicReplies: true,
      governedBySavedRules: true,
      mayUseEditedOrGeneratedDrafts: true,
      disableInstructions: 'Use Emergency Pause or revoke consent to stop future automatic publishing.',
      runtimeEnabled: false,
    },
  })
}

export async function POST(request: NextRequest) {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  const guard = mutationGuard(request, access.userId)
  if (guard) return guard
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (body.action !== 'grant' && body.action !== 'revoke') {
    return NextResponse.json({ error: 'Consent action must be grant or revoke.' }, { status: 400 })
  }

  let rpc: string
  let args: Record<string, unknown>
  if (body.action === 'grant') {
    const acknowledgements = body.acknowledgements as Record<string, unknown> | undefined
    if (body.consentVersion !== YOUTUBE_AUTO_PUBLISH_CONSENT_VERSION
      || acknowledgements?.publishesPublicReplies !== true
      || acknowledgements?.usesSavedRules !== true
      || acknowledgements?.canPauseOrRevoke !== true) {
      return NextResponse.json({ error: 'All auto-publishing disclosures must be explicitly acknowledged.' }, { status: 400 })
    }
    rpc = 'grant_youtube_auto_publish_consent'
    args = {
      p_connection_id: access.connection.id,
      p_owner_id: access.userId,
      p_consent_version: YOUTUBE_AUTO_PUBLISH_CONSENT_VERSION,
    }
  } else {
    rpc = 'revoke_youtube_auto_publish_consent'
    args = { p_connection_id: access.connection.id, p_owner_id: access.userId }
  }
  const { data, error } = await access.admin.rpc(rpc, args)
  if (error) {
    console.error('[YouTube automation consent] Change failed:', error.code)
    return NextResponse.json({ error: 'Unable to update auto-publishing consent.' }, { status: 500 })
  }
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
  return NextResponse.json({
    consentCurrent: body.action === 'grant',
    publishingMode: row.publishing_mode,
    grantedAt: row.auto_publish_authorized_at,
    revokedAt: row.auto_publish_revoked_at,
    runtimeEnabled: false,
  })
}
