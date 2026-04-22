import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, placeId } = await req.json()

  if (!name || !email || !placeId) {
    return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Check if this email already has a restaurant — let them sign in
  const { data: existing } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', email)
    .single()

  if (existing) {
    // Restaurant exists — client will send sign-in OTP
    return NextResponse.json({ success: true, id: existing.id, alreadyExists: true })
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

  // Pre-create the auth user with email confirmed so OTP works even when
  // Supabase "Email Confirm" is ON. The client sends the actual magic link.
  const { error: createUserError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  if (createUserError && !createUserError.message.toLowerCase().includes('already')) {
    console.error('[restaurants/create] createUser error:', createUserError.message)
  }

  return NextResponse.json({ success: true, id: data.id })
}
