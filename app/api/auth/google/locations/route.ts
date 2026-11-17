import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  getValidGoogleBusinessAccessToken,
  GoogleBusinessAuthorizationError,
  type GoogleBusinessConnectionRow,
} from '@/lib/googleBusinessConnection'
import { getGoogleBusinessAvailability } from '@/lib/googleBusinessFeature'
import { getGoogleBusinessWorkspaceForUser } from '@/lib/googleBusinessWorkspace'
import {
  GoogleLocationsError,
  listGoogleBusinessLocations,
} from '@/lib/googleLocations'
import { getPlanLimits } from '@/lib/planLimits'

export async function GET() {
  const availability = getGoogleBusinessAvailability()
  if (!availability.enabled) {
    return NextResponse.json(
      { error: availability.message, code: availability.code },
      { status: 503 }
    )
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
    .select('id, workspace_id, google_subject, access_token_encrypted, refresh_token_encrypted, token_expires_at, status')
    .eq('workspace_id', context.workspace.id)
    .maybeSingle<GoogleBusinessConnectionRow>()
  if (connectionError) {
    return NextResponse.json({ error: 'Unable to load Google connection.' }, { status: 500 })
  }
  if (!connection?.google_subject) {
    return NextResponse.json({ error: 'Google Business Profile is not connected.' }, { status: 400 })
  }

  try {
    const accessToken = await getValidGoogleBusinessAccessToken(connection, admin)
    const [discovered, selectedResult, countResult] = await Promise.all([
      listGoogleBusinessLocations(accessToken),
      admin
        .from('google_business_locations')
        .select('review_parent_resource_name, location_id, restaurant_id')
        .eq('workspace_id', context.workspace.id)
        .eq('is_active', true),
      admin
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', context.workspace.id),
    ])
    if (selectedResult.error || countResult.error) {
      throw selectedResult.error ?? countResult.error
    }
    const { accounts, locations } = discovered
    const selected = selectedResult.data
    const locationCount = countResult.count
    const selectedByResource = new Map(
      (selected ?? []).map(item => [item.review_parent_resource_name, item.restaurant_id])
    )
    const selectedCanonicalIds = new Set((selected ?? []).map(item => item.location_id))

    return NextResponse.json({
      accounts,
      locations: locations.map(location => ({
        ...location,
        selected: selectedByResource.has(location.reviewResourceName),
        canonicalLinked: selectedCanonicalIds.has(location.locationId),
        restaurantId: selectedByResource.get(location.reviewResourceName) ?? null,
      })),
      locationLimit: getPlanLimits(context.account.plan).locations,
      currentLocationCount: locationCount ?? 0,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof GoogleBusinessAuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof GoogleLocationsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[Google Business locations] Discovery failed:', error)
    return NextResponse.json(
      { error: 'Unable to load Google Business Profile locations.' },
      { status: 502 }
    )
  }
}
