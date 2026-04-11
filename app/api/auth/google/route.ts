import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/signin', process.env.NEXT_PUBLIC_BASE_URL!))
  }

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) {
    return NextResponse.redirect(new URL('/onboard', process.env.NEXT_PUBLIC_BASE_URL!))
  }

  // Use restaurantId as state — verified on callback against the authenticated user's restaurant
  const state = restaurant.id

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent', // always return refresh_token
    state,
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )

  // Store state in cookie to verify on callback (CSRF protection)
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
