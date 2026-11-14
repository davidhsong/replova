import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { isSameOriginRequest } from '@/lib/accountOnboarding'

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET() {
  if (!isConfigured()) return json({ authenticated: false, configured: false })

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    await supabase.auth.signOut().catch(() => undefined)
    return json({ authenticated: false, configured: true })
  }

  return json({ authenticated: Boolean(user), configured: true })
}

export async function POST(request: NextRequest) {
  if (!isConfigured()) return json({ error: 'Authentication is not configured' }, 503)

  if (!isSameOriginRequest(request)) {
    return json({ error: 'Invalid request origin' }, 403)
  }

  let body: { accessToken?: unknown; refreshToken?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request body' }, 400)
  }

  if (typeof body.accessToken !== 'string' || typeof body.refreshToken !== 'string') {
    return json({ error: 'Session tokens are required' }, 400)
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { error } = await supabase.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  })

  if (error) return json({ error: 'The sign-in link is invalid or expired' }, 401)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'Unable to verify the signed-in account' }, 401)

  return json({ authenticated: true })
}
