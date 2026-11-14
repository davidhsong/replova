import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/baseUrl'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.redirect(new URL('/signin', BASE_URL))
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL('/dashboard/settings?youtube_error=not_configured', BASE_URL))
  }

  const state = randomBytes(32).toString('base64url')
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE_URL}/api/auth/youtube/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    state,
  })

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  response.cookies.set('youtube_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/auth/youtube',
  })
  return response
}
