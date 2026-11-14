import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await getSupabaseAdmin()
    .from('youtube_connections')
    .select('channel_id, channel_title, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Unable to load YouTube connection.' }, { status: 500 })
  return NextResponse.json({
    connected: Boolean(data),
    channelId: data?.channel_id ?? null,
    channelTitle: data?.channel_title ?? null,
  })
}
