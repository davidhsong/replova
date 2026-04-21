import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { name, email, placeId, redirectTo } = await req.json()

  if (!name || !email || !placeId) {
    return NextResponse.json({ error: 'name, email, and placeId are required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Check if this email already has a restaurant
  const { data: existing } = await admin
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

  // Generate a magic link server-side so no email needs to be sent.
  // redirectTo must go through /auth/callback so the PKCE code is exchanged
  // for a session before any SSR page renders.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const callbackUrl = redirectTo ?? `${baseUrl}/auth/callback?next=%2Fdashboard%3Fsuccess%3D1`
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: callbackUrl },
  })

  if (linkError) {
    // Restaurant was created — still succeed but without a direct link
    return NextResponse.json({ success: true, id: data.id })
  }

  return NextResponse.json({ success: true, id: data.id, magicLink: linkData.properties.action_link })
}
