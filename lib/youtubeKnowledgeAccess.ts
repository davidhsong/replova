import 'server-only'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from './supabase'
import { createClient } from '@/utils/supabase/server'

export async function getYouTubeKnowledgeAccess() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = getSupabaseAdmin()
  const { data: connection, error } = await admin
    .from('youtube_connections')
    .select('id, user_id, channel_id, channel_title')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; user_id: string; channel_id: string; channel_title: string | null }>()
  if (error) {
    console.error('[YouTube knowledge] Connection lookup failed:', error.code)
    return { ok: false as const, error: NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 }) }
  }
  if (!connection) {
    return { ok: false as const, error: NextResponse.json({ error: 'Connect YouTube before managing reply context.' }, { status: 404 }) }
  }

  return {
    ok: true as const,
    admin,
    connection: {
      id: connection.id,
      userId: connection.user_id,
      channelId: connection.channel_id,
      channelTitle: connection.channel_title,
    },
  }
}
