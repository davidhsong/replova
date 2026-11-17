import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getGoogleBusinessAvailability,
  isGoogleBusinessReviewPublishingEnabled,
  isGoogleBusinessReviewSyncEnabled,
} from '@/lib/googleBusinessFeature'
import { getGoogleBusinessWorkspaceForUser } from '@/lib/googleBusinessWorkspace'

export async function GET() {
  const supabase = createClient(await cookies())
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email || !user.email_confirmed_at) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const context = await getGoogleBusinessWorkspaceForUser(admin, user)
  if (!context) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const availability = getGoogleBusinessAvailability()
  const [connectionResult, locationsResult, legacyResult] = await Promise.all([
    admin
      .from('google_business_connections')
      .select('id, google_email, status, connected_at, refreshed_at, last_error_code')
      .eq('workspace_id', context.workspace.id)
      .maybeSingle<{
        id: string
        google_email: string | null
        status: string
        connected_at: string
        refreshed_at: string | null
        last_error_code: string | null
      }>(),
    admin
      .from('google_business_locations')
      .select('id, restaurant_id, title, location_id, account_resource_name, location_resource_name, review_parent_resource_name, is_active')
      .eq('workspace_id', context.workspace.id)
      .eq('is_active', true)
      .order('selected_at', { ascending: true }),
    admin
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', context.workspace.id)
      .not('google_refresh_token', 'is', null),
  ])
  if (connectionResult.error || locationsResult.error || legacyResult.error) {
    console.error(
      '[Google Business status] Database lookup failed:',
      connectionResult.error ?? locationsResult.error ?? legacyResult.error
    )
    return NextResponse.json({ error: 'Unable to load Google Business Profile status.' }, { status: 500 })
  }

  const connection = connectionResult.data
  const selectedLocationRows = locationsResult.data ?? []
  const seenCanonicalLocations = new Set<string>()
  const selectedLocations = selectedLocationRows.filter(location => {
    const identity = location.restaurant_id ?? location.location_id
    if (seenCanonicalLocations.has(identity)) return false
    seenCanonicalLocations.add(identity)
    return true
  })
  const legacyCredentialCount = legacyResult.count

  return NextResponse.json({
    available: availability.enabled,
    availabilityCode: availability.code,
    availabilityMessage: availability.message,
    connected: connection?.status === 'active',
    connectionStatus: connection?.status ?? 'not_connected',
    googleEmail: connection?.google_email ?? null,
    connectedAt: connection?.connected_at ?? null,
    refreshedAt: connection?.refreshed_at ?? null,
    lastErrorCode: connection?.last_error_code ?? null,
    legacyCredentialsPresent: (legacyCredentialCount ?? 0) > 0,
    selectedLocations,
    capabilities: {
      locationDiscovery: availability.enabled,
      reviewSync: isGoogleBusinessReviewSyncEnabled(),
      reviewPublishing: isGoogleBusinessReviewPublishingEnabled(),
      automatedReplies: false,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
