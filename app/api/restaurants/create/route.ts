import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, placeId } = await req.json()

  if (!name || !email || !placeId) {
    return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
  }

  // Check if this email already has a restaurant
  const { data: existing } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('owner_email', email)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Please sign in instead.' },
      { status: 409 }
    )
  }

  const { data, error } = await getSupabaseAdmin()
    .from('restaurants')
    .insert({ name, place_id: placeId, owner_email: email, active: false })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('restaurants_place_id_key')) {
      return NextResponse.json(
        { error: 'This Google Place ID is already registered. Contact support if this is your restaurant.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
