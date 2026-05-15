import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { analyzeAndSaveReview } from '@/lib/sentiment'
import type { Plan } from '@/lib/planLimits'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const admin = getSupabaseAdmin()

  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const plan: Plan = (account?.plan as Plan) ?? 'starter'
  if (plan === 'starter') {
    return NextResponse.json(
      { error: 'Sentiment analysis requires Growth plan or higher.' },
      { status: 403 }
    )
  }

  // Look up review first, then verify restaurant ownership (supports multi-location users)
  const { data: review } = await admin
    .from('reviews')
    .select('id, restaurant_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', review.restaurant_id)
    .eq('owner_email', user.email!)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const result = await analyzeAndSaveReview(reviewId)

  return NextResponse.json(result)
}
