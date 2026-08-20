import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

export async function proxy(request: NextRequest) {
  request.headers.set('x-replova-pathname', request.nextUrl.pathname)
  const { supabase, supabaseResponse } = createClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/signin'
    url.search = ''
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
