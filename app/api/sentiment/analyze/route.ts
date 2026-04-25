import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { analyzeAndSaveReview } from '@/lib/sentiment'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const admin = getSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const { data: review } = await admin
    .from('reviews')
    .select('id')
    .eq('id', reviewId)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const result = await analyzeAndSaveReview(reviewId)

  return NextResponse.json(result)
}
