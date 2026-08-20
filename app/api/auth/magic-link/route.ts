import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/baseUrl'
import { safeRedirectPath } from '@/lib/safeRedirect'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// The anon client sends the email without exposing a generated token to the caller.
function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; next?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = body.email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  const next = typeof body.next === 'string' ? safeRedirectPath(body.next) : '/dashboard'

  // Only registered account owners may receive a link. This is also why every
  // signInWithOtp call must set shouldCreateUser to false.
  const { data: account, error: lookupError } = await getAdminClient()
    .from('accounts')
    .select('owner_email')
    .eq('owner_email', normalizedEmail)
    .maybeSingle()

  if (lookupError) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
  if (!account) {
    return NextResponse.json(
      { error: 'No account found for this email. Please sign up first.' },
      { status: 404 }
    )
  }

  // The server-side client uses the implicit flow. Tokens return in the URL
  // fragment, which is handled by the client-side /signin page.
  const { error } = await getPublicClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${BASE_URL}/signin?next=${encodeURIComponent(next)}`,
    },
  })

  if (error) {
    return NextResponse.json({ error: 'Unable to send a sign-in link. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
