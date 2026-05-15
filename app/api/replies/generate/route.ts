import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { queueReplyForReview } from '@/lib/replyQueue'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reviewId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { reviewId } = body
  if (!reviewId || typeof reviewId !== 'string') {
    return NextResponse.json({ error: 'reviewId required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify ownership via the review's restaurant_id (supports multi-location users)
  const { data: review } = await admin
    .from('reviews')
    .select('id, restaurant_id')
    .eq('id', reviewId)
    .maybeSingle<{ id: string; restaurant_id: string }>()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', review.restaurant_id)
    .eq('owner_email', user.email!)
    .maybeSingle<{ id: string }>()

  if (!restaurant) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  try {
    const { queueId } = await queueReplyForReview(reviewId)
    return NextResponse.json({ success: true, queueId })
  } catch (err) {
    console.error('queueReplyForReview failed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate reply' },
      { status: 500 }
    )
  }
}
