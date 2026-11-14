import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export async function DELETE() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await getSupabaseAdmin()
    .from('youtube_connections')
    .delete()
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Unable to disconnect YouTube.' }, { status: 500 })
  return NextResponse.json({ success: true })
}
