import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlanLimits } from '@/lib/planLimits'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

type Plan = 'starter' | 'growth' | 'agency'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function resolvePlan(raw: unknown): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

function isExistingAuthUserError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('already') || normalized.includes('registered') || normalized.includes('exists')
}

export async function POST(req: NextRequest) {
  let body: { name?: unknown; email?: unknown; placeId?: unknown; plan?: unknown; addMode?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : ''
  const addMode = body.addMode === true

  if (!name || !email || !placeId) {
    return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  if (name.length > 200 || placeId.length > 300) {
    return NextResponse.json({ error: 'Business details are too long' }, { status: 400 })
  }

  try {
    const admin = getSupabaseAdmin()
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const isAuthenticatedOwner = authUser?.email?.toLowerCase() === email

    if (addMode && !isAuthenticatedOwner) {
      return NextResponse.json({ error: 'Sign in before adding a location' }, { status: 401 })
    }

    const { data: existingRestaurants, error: existingError } = await admin
      .from('restaurants')
      .select('id, active')
      .eq('owner_email', email)
      .order('created_at', { ascending: true })

    if (existingError) {
      return NextResponse.json({ error: 'Unable to check the account' }, { status: 500 })
    }

    // A signed-out owner who already registered should sign in rather than
    // create or modify locations through the public onboarding endpoint.
    if (!isAuthenticatedOwner && (existingRestaurants?.length ?? 0) > 0) {
      const chosenPlan = resolvePlan(body.plan)
      const { error: accountUpsertError } = await admin.from('accounts').upsert(
        { owner_email: email, plan: chosenPlan },
        { onConflict: 'owner_email', ignoreDuplicates: true }
      )
      if (accountUpsertError) {
        return NextResponse.json({ error: 'Unable to prepare this account' }, { status: 500 })
      }
      const { error: createUserError } = await admin.auth.admin.createUser({ email, email_confirm: true })
      if (createUserError && !isExistingAuthUserError(createUserError.message)) {
        return NextResponse.json({ error: 'Unable to prepare sign-in for this account' }, { status: 500 })
      }
      return NextResponse.json({ success: true, id: existingRestaurants![0].id, alreadyExists: true })
    }

    const { data: account, error: accountLookupError } = await admin
      .from('accounts')
      .select('plan')
      .eq('owner_email', email)
      .maybeSingle()

    if (accountLookupError) {
      return NextResponse.json({ error: 'Unable to load the account plan' }, { status: 500 })
    }

    const chosenPlan = resolvePlan(body.plan)
    const currentPlan: Plan = (account?.plan as Plan | undefined) ?? chosenPlan
    const limits = getPlanLimits(currentPlan)

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

    if (existingPlaceError) {
      return NextResponse.json({ error: 'Unable to verify this business listing' }, { status: 500 })
    }

    if (existingPlace) {
      return NextResponse.json(
        { error: existingPlace.owner_email === email
          ? 'This business is already on your account.'
          : 'This business is already registered. Contact support if you own it.' },
        { status: 409 }
      )
    }

    if (!account) {
      const { error: accountError } = await admin
        .from('accounts')
        .insert({ owner_email: email, plan: chosenPlan })
      if (accountError) {
        return NextResponse.json({ error: 'Unable to create the account' }, { status: 500 })
      }
    }

    if (!isAuthenticatedOwner) {
      const { error: createUserError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createUserError && !isExistingAuthUserError(createUserError.message)) {
        if (!account) await admin.from('accounts').delete().eq('owner_email', email)
        return NextResponse.json({ error: 'Unable to prepare your sign-in' }, { status: 500 })
      }
    }

    const { data: restaurant, error: restaurantError } = await admin
      .from('restaurants')
      .insert({
        name,
        place_id: placeId,
        owner_email: email,
        active: addMode && (existingRestaurants ?? []).some(existing => existing.active),
      })
      .select('id')
      .single()

    if (restaurantError || !restaurant) {
      if (!account) await admin.from('accounts').delete().eq('owner_email', email)
      return NextResponse.json({ error: restaurantError?.message ?? 'Unable to add this business' }, { status: 500 })
    }

    // Creating settings up front makes documented defaults effective for
    // alerts and auto-replies before the owner first opens Settings.
    const { error: settingsError } = await admin
      .from('restaurant_settings')
      .upsert({ restaurant_id: restaurant.id }, { onConflict: 'restaurant_id' })

    if (settingsError) {
      await admin.from('restaurants').delete().eq('id', restaurant.id)
      if (!account) await admin.from('accounts').delete().eq('owner_email', email)
      return NextResponse.json({ error: 'Unable to initialize business settings' }, { status: 500 })
    }

    const response = NextResponse.json({ success: true, id: restaurant.id })
    if (addMode) {
      response.cookies.set(ACTIVE_LOCATION_COOKIE, restaurant.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }
    return response
  } catch (err) {
    console.error('[restaurants/create] unhandled error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
