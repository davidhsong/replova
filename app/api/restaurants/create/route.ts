import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import { accountCanActivateNewLocations } from '@/lib/accountEntitlements'
import { isSameOriginRequest } from '@/lib/accountOnboarding'
import { getPlanLimits } from '@/lib/planLimits'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  let body: { name?: unknown; placeId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : ''
  if (!name || !placeId) {
    return NextResponse.json({ error: 'Business name and Places ID are required.' }, { status: 400 })
  }
  if (name.length > 200 || placeId.length > 300) {
    return NextResponse.json({ error: 'Business details are too long.' }, { status: 400 })
  }

  const supabase = createClient(await cookies())
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user?.email) {
    return NextResponse.json({ error: 'Sign in before adding a location.' }, { status: 401 })
  }
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Verify your email before adding a location.' }, { status: 403 })
  }

  try {
    const admin = getSupabaseAdmin()
    const account = await getAccountForAuthUser(admin, user)
    if (!account || account.auth_user_id !== user.id) {
      return NextResponse.json({ error: 'Create your business workspace first.' }, { status: 409 })
    }

    const { data: workspace, error: workspaceError } = await admin
      .from('business_workspaces')
      .select('id')
      .eq('account_id', account.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (workspaceError) throw workspaceError
    if (!workspace) {
      return NextResponse.json({ error: 'Create your business workspace first.' }, { status: 409 })
    }

    const { data: existingRestaurants, error: existingError } = await admin
      .from('restaurants')
      .select('id, active')
      .eq('owner_email', account.owner_email)
      .order('created_at', { ascending: true })
    if (existingError) throw existingError

    const limits = getPlanLimits(account.plan)
    if ((existingRestaurants?.length ?? 0) >= limits.locations) {
      return NextResponse.json(
        { error: 'You have reached the location limit for your plan. Upgrade to add more locations.' },
        { status: 400 }
      )
    }

    const { data: existingPlace, error: existingPlaceError } = await admin
      .from('restaurants')
      .select('id, owner_email')
      .eq('place_id', placeId)
      .maybeSingle()
    if (existingPlaceError) throw existingPlaceError
    if (existingPlace) {
      return NextResponse.json(
        { error: existingPlace.owner_email === account.owner_email
          ? 'This location is already on your account.'
          : 'This location is already registered. Contact support if you manage it.' },
        { status: 409 }
      )
    }

    const existingAccess = (existingRestaurants ?? []).some(restaurant => restaurant.active)
    const firstLocationAccess = existingRestaurants?.length === 0
      ? await accountCanActivateNewLocations(account)
      : false

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .insert({
        name,
        place_id: placeId,
        owner_email: account.owner_email,
        workspace_id: workspace.id,
        active: existingAccess || firstLocationAccess,
      })
      .select('id')
      .single()
    if (restaurantError || !restaurant) {
      return NextResponse.json({ error: restaurantError?.message ?? 'Unable to add this location.' }, { status: 500 })
    }

    const { error: settingsError } = await admin
      .from('restaurant_settings')
      .upsert({ restaurant_id: restaurant.id }, { onConflict: 'restaurant_id' })
    if (settingsError) {
      await admin.from('restaurants').delete().eq('id', restaurant.id)
      return NextResponse.json({ error: 'Unable to initialize location settings.' }, { status: 500 })
    }

    const response = NextResponse.json({ success: true, id: restaurant.id })
    response.cookies.set(ACTIVE_LOCATION_COOKIE, restaurant.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  } catch (error) {
    console.error('[restaurants/create] failed:', error)
    return NextResponse.json({ error: 'Unable to add this location.' }, { status: 500 })
  }
}
