import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthEmailRedirectTo } from '@/lib/authRedirect'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  isExistingAuthIdentityError,
  isSameOriginRequest,
  normalizeOnboardingEmail,
} from '@/lib/accountOnboarding'

function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    && process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: 'Email signup is not configured.' }, { status: 503 })
  }

  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const email = normalizeOnboardingEmail(body.email)
  if (!email) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  const next = '/onboard/workspace'
  const emailRedirectTo = getAuthEmailRedirectTo(request, next)
  if (!emailRedirectTo) {
    return NextResponse.json({ error: 'Invalid authentication origin.' }, { status: 403 })
  }
  // Creating an unconfirmed Auth identity first lets every OTP call keep the
  // shouldCreateUser:false invariant. No Replova account is created until the
  // recipient proves control of this inbox and opens an authenticated session.
  const { error: createUserError } = await getSupabaseAdmin().auth.admin.createUser({
    email,
    email_confirm: false,
  })
  if (createUserError && !isExistingAuthIdentityError(createUserError.message)) {
    return NextResponse.json({ error: 'Unable to prepare secure signup.' }, { status: 500 })
  }

  const { error: linkError } = await getPublicClient().auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo,
    },
  })

  if (linkError) {
    return NextResponse.json({ error: 'Unable to send your verification link.' }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
