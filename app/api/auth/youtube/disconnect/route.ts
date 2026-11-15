import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as { confirmed?: unknown } | null
  if (body?.confirmed !== true) {
    return NextResponse.json({ error: 'Explicit disconnect confirmation is required.' }, { status: 400 })
  }

  const { error } = await getSupabaseAdmin()
    .from('youtube_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Unable to disconnect YouTube.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
