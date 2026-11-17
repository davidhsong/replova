import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isSameOriginRequest } from '@/lib/accountOnboarding'
import { decryptGoogleBusinessToken } from '@/lib/googleBusinessTokens'
import { getGoogleBusinessWorkspaceForUser } from '@/lib/googleBusinessWorkspace'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

type StoredConnection = {
  id: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const supabase = createClient(await cookies())
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const context = await getGoogleBusinessWorkspaceForUser(admin, user)
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { data: connection, error: connectionError } = await admin
    .from('google_business_connections')
    .select('id, access_token_encrypted, refresh_token_encrypted')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle<StoredConnection>()
  if (connectionError) {
    return NextResponse.json({ error: 'Unable to load Google connection.' }, { status: 500 })
  }

  const { count: youtubeConnectionCount, error: youtubeLookupError } = await admin
    .from('youtube_connections')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (youtubeLookupError) {
    return NextResponse.json({ error: 'Unable to verify optional integrations.' }, { status: 500 })
  }

  let revocationWarning: string | null = null
  let tokenToRevoke: string | null = null
  if (connection) {
    try {
      tokenToRevoke = connection.refresh_token_encrypted
        ? decryptGoogleBusinessToken(connection.refresh_token_encrypted, 'refresh').plaintext
        : connection.access_token_encrypted
          ? decryptGoogleBusinessToken(connection.access_token_encrypted, 'access').plaintext
          : null
    } catch (error) {
      console.error('[Google Business OAuth] Could not decrypt token for revocation:', error)
      revocationWarning = 'Google could not be notified, but Replova removed its stored access.'
    }
  }

  const { error: disconnectError } = await admin.rpc('disconnect_google_business_workspace', {
    p_workspace_id: context.workspace.id,
    p_auth_user_id: user.id,
  })
  if (disconnectError) {
    console.error('[Google Business OAuth] Atomic disconnect failed:', disconnectError.message)
    return NextResponse.json({ error: 'Unable to disconnect Google Business Profile.' }, { status: 500 })
  }

  // Google token revocation can invalidate the user's wider grant for the
  // same OAuth client. Preserve a separately stored YouTube connection by
  // deleting only Replova's GBP credentials in that case.
  if (tokenToRevoke && (youtubeConnectionCount ?? 0) === 0) {
    try {
      const revokeResponse = await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tokenToRevoke }),
        cache: 'no-store',
      })
      if (!revokeResponse.ok && revokeResponse.status !== 400) {
        revocationWarning = 'Google could not be notified, but Replova removed its stored access.'
      }
    } catch (error) {
      console.error('[Google Business OAuth] Revocation request failed:', error)
      revocationWarning = 'Google could not be notified, but Replova removed its stored access.'
    }
  } else if (tokenToRevoke) {
    revocationWarning = 'Replova removed Google Business access while preserving the separate YouTube connection. You can revoke the wider Google grant from your Google Account.'
  }

  return NextResponse.json({ success: true, warning: revocationWarning })
}
