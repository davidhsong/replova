import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthCallbackRedirects } from '@/lib/authRedirect'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const rawType = searchParams.get('type')
  const type = rawType === 'magiclink' || rawType === 'signup' || rawType === 'email'
    ? rawType
    : null
  const redirects = getAuthCallbackRedirects(req.url, searchParams.get('next'))

  if (!redirects) {
    return NextResponse.json({ error: 'Invalid authentication callback origin.' }, { status: 400 })
  }

  const errorResponse = NextResponse.redirect(redirects.error)
  const successResponse = NextResponse.redirect(redirects.success)

  if (code || (tokenHash && type)) {
    // Build the supabase client writing cookies onto whichever response we end up returning.
    // We create it lazily so both error and success responses share the same cookie handler.
    let activeResponse = successResponse

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              activeResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    try {
      let authError: Error | null = null
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        authError = error
      } else if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        authError = error
      }

      if (authError) {
        console.error('[auth/callback] error:', authError.message)
        // Swap activeResponse BEFORE signOut so clear-cookie headers land on the error redirect.
        activeResponse = errorResponse
        await supabase.auth.signOut()
        return errorResponse
      }

      return successResponse
    } catch (err) {
      console.error('[auth/callback] unexpected error:', err)
      return errorResponse
    }
  }

  return errorResponse
}
