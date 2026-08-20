import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/signin', BASE_URL))
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL('/dashboard/settings?google_error=not_configured', BASE_URL))
  }

  const admin = getSupabaseAdmin()

  // Resolve the active location (from the location-switcher cookie) rather than
  // always defaulting to the account's oldest restaurant. Otherwise "Connect
  // Google" for a non-primary location on a multi-location plan silently links
  // tokens to the wrong restaurant.
  let restaurant: { id: string } | null = null
  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .eq('active', true)
      .maybeSingle()
    restaurant = data
  }
  if (!restaurant) {
    const { data } = await admin
      .from('restaurants')
      .select('id')
      .eq('owner_email', user.email)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    restaurant = data
  }

  if (!restaurant) {
    return NextResponse.redirect(new URL('/onboard', BASE_URL))
  }

  const state = crypto.randomUUID()

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${BASE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/business.manage',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
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
  response.cookies.set('google_oauth_restaurant', restaurant.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return response
}
