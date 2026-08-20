import { NextRequest, NextResponse } from 'next/server'
import { sendNegativeReviewAlert } from '@/lib/alerts'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId } = await req.json().catch(() => ({ reviewId: null }))
  if (!reviewId || typeof reviewId !== 'string') {
    return NextResponse.json({ error: 'reviewId is required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: review } = await admin
    .from('reviews')
    .select('restaurant_id')
    .eq('id', reviewId)
    .maybeSingle()
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', review.restaurant_id)
    .eq('owner_email', user.email)
    .maybeSingle()
  if (!restaurant) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  await sendNegativeReviewAlert(reviewId)
  return NextResponse.json({ success: true })
}
