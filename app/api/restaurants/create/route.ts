import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, placeId } = await req.json()

  if (!name || !email || !placeId) {
    return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('restaurants')
    .insert({ name, place_id: placeId, owner_email: email, active: false })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id })
}
