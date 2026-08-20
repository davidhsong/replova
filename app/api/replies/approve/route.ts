import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { queueId?: string; approved?: boolean; editedReply?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { queueId, approved, editedReply } = body

  if (!queueId || typeof queueId !== 'string') {
    return NextResponse.json({ error: 'queueId required' }, { status: 400 })
  }
  if (typeof approved !== 'boolean') {
    return NextResponse.json({ error: 'approved (boolean) required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Fetch the queue entry and verify ownership via restaurant
  const { data: queueEntry } = await admin
    .from('reply_queue')
    .select('id, restaurant_id, scheduled_send_at')
    .eq('id', queueId)
    .single<{ id: string; restaurant_id: string; scheduled_send_at: string | null }>()

  if (!queueEntry) return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 })

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, active')
    .eq('id', queueEntry.restaurant_id)
    .eq('owner_email', user.email)
    .single<{ id: string; active: boolean }>()

  if (!restaurant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  if (!restaurant.active) return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const update: Record<string, unknown> = { approved }
  if (editedReply && typeof editedReply === 'string') {
    update.edited_reply = editedReply
  }

  // If approving with no scheduled time, schedule for 5 minutes from now
  if (approved && !queueEntry.scheduled_send_at) {
    update.scheduled_send_at = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  }

  const { error } = await admin.from('reply_queue').update(update).eq('id', queueId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
