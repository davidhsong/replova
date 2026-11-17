import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import { accountCanActivateNewLocations } from '@/lib/accountEntitlements'
import { isSameOriginRequest } from '@/lib/accountOnboarding'
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
  selectAuthorizedGoogleBusinessLocations,
} from '@/lib/googleLocations'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

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

  let body: { reviewResourceNames?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (
    !Array.isArray(body.reviewResourceNames)
    || body.reviewResourceNames.length < 1
    || body.reviewResourceNames.length > 15
    || body.reviewResourceNames.some(value => typeof value !== 'string')
  ) {
    return NextResponse.json({ error: 'Select between 1 and 15 Google locations.' }, { status: 400 })
  }

  const requestedResources = [...new Set(
    (body.reviewResourceNames as string[]).map(value => value.trim())
  )]
  if (
    requestedResources.length < 1
    || requestedResources.some(value => !/^accounts\/[A-Za-z0-9_-]{1,128}\/locations\/[A-Za-z0-9_-]{1,128}$/.test(value))
  ) {
    return NextResponse.json({ error: 'Invalid Google location resource.' }, { status: 400 })
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
    const { locations } = await listGoogleBusinessLocations(accessToken)
    const selected = selectAuthorizedGoogleBusinessLocations(requestedResources, locations)

    const activateNewLocations = await accountCanActivateNewLocations(context.account)

    const { data: linkedRows, error: linkError } = await admin.rpc(
      'link_google_business_locations',
      {
        p_workspace_id: context.workspace.id,
        p_auth_user_id: user.id,
        p_connection_id: connection.id,
        p_google_subject: connection.google_subject,
        p_locations: selected.map(location => ({
          accountResourceName: location.accountResourceName,
          accountId: location.accountId,
          locationResourceName: location.locationResourceName,
          locationId: location.locationId,
          reviewResourceName: location.reviewResourceName,
          title: location.title,
          placeId: location.placeId,
        })),
        p_new_locations_active: activateNewLocations,
      }
    )
    if (linkError) {
      const message = linkError.message
      if (/subscription_location_limit_exceeded/i.test(message)) {
        return NextResponse.json(
          { error: 'Your plan does not have enough available location slots.' },
          { status: 409 }
        )
      }
      if (/already_linked|location_conflict/i.test(message)) {
        return NextResponse.json(
          { error: 'A selected Google location is already linked to another Replova location.' },
          { status: 409 }
        )
      }
      if (/ambiguous_legacy_google_location/i.test(message)) {
        return NextResponse.json(
          { error: 'This Google location matches multiple existing business records and requires manual resolution.' },
          { status: 409 }
        )
      }
      if (/google_business_connection_required/i.test(message)) {
        return NextResponse.json(
          { error: 'The Google connection changed while locations were being verified. Refresh and try again.' },
          { status: 409 }
        )
      }
      if (/workspace_not_owned/i.test(message)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      throw linkError
    }

    const rows = Array.isArray(linkedRows) ? linkedRows : []
    const response = NextResponse.json({
      success: true,
      linked: rows.map(row => ({
        locationLinkId: row.location_link_id,
        restaurantId: row.linked_restaurant_id,
        reviewResourceName: row.linked_review_resource_name,
        restaurantCreated: row.restaurant_created === true,
      })),
    })
    const firstRestaurantId = rows[0]?.linked_restaurant_id
    if (firstRestaurantId) {
      response.cookies.set(ACTIVE_LOCATION_COOKIE, firstRestaurantId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
    return response
  } catch (error) {
    if (error instanceof GoogleBusinessAuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    if (error instanceof GoogleLocationsError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    }
    console.error('[Google Business locations] Selection failed:', error)
    return NextResponse.json({ error: 'Unable to link Google locations.' }, { status: 500 })
  }
}
