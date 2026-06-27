import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlanLimits } from '@/lib/planLimits'

type Plan = 'starter' | 'growth' | 'agency'

function resolvePlan(raw: unknown): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, placeId, plan: rawPlan } = await req.json()

    if (!name || !email || !placeId) {
      return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Determine if the caller is already authenticated (add-location flow vs initial signup)
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const isAuthenticated = !!authUser && authUser.email === email

    if (!isAuthenticated) {
      // Initial signup: if this email already has restaurants, send them to sign in
      const { data: existing } = await admin
        .from('restaurants')
        .select('id')
        .eq('owner_email', email)
        .limit(1)
        .maybeSingle()

      if (existing) {
        return NextResponse.json({ success: true, id: existing.id, alreadyExists: true })
      }
    }

    // Look up the account to determine plan and location limit
    const { data: account } = await admin
      .from('accounts')
      .select('plan')
      .eq('owner_email', email)
      .maybeSingle()

    const currentPlan: Plan = account?.plan ?? 'starter'
    const limits = getPlanLimits(currentPlan)

    // Count existing restaurants for this email
    const { count: existingCount } = await admin
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .eq('owner_email', email)

    if ((existingCount ?? 0) >= limits.locations) {
      return NextResponse.json(
        { error: 'You have reached the location limit for your plan. Upgrade to add more locations.' },
        { status: 400 }
      )
    }

    const { data, error } = await admin
      .from('restaurants')
      .insert({ name, place_id: placeId, owner_email: email, active: false })
      .select('id')
      .single()

    if (error) {
      if (error.message.includes('restaurants_place_id_key')) {
        return NextResponse.json(
          { error: 'This Google Place ID is already registered. Contact support if this is your business.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Upsert account row — creates with chosen plan for new users, leaves plan unchanged for existing users
    const chosenPlan = resolvePlan(rawPlan)
    await admin
      .from('accounts')
      .upsert(
        { owner_email: email, plan: chosenPlan },
        { onConflict: 'owner_email', ignoreDuplicates: true }
      )

    // For initial signup only: pre-create the auth user with email confirmed
    if (!isAuthenticated) {
      const { error: createUserError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      })
      if (createUserError && !createUserError.message.toLowerCase().includes('already')) {
        console.error('[restaurants/create] createUser error:', createUserError.message)
      }
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    console.error('[restaurants/create] unhandled error:', err)
    const message = err instanceof Error ? err.message : 'An unexpected error occurred'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
