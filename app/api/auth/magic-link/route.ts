import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { BASE_URL } from '@/lib/baseUrl'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Use anon key so signInWithOtp routes through Supabase's email delivery,
// not admin.generateLink which returns the raw token to the caller.
function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function POST(req: NextRequest) {
  const { email, redirectTo } = await req.json()

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Only send a magic link to users who already have an account.
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

  const { error } = await getPublicClient().auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo ?? `${BASE_URL}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true })
}
