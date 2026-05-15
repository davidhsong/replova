import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reviewId, completed } = await req.json()
  if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // Look up the review first to get restaurant_id (supports multi-location users)
  const { data: review } = await admin
    .from('reviews')
    .select('id, restaurant_id')
    .eq('id', reviewId)
    .maybeSingle()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  // Verify the restaurant belongs to this user
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('id', review.restaurant_id)
    .eq('owner_email', user.email!)
    .maybeSingle()

  if (!restaurant) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

  const updateData: Record<string, unknown> = {
    status: completed ? 'replied' : 'drafted',
  }
  if (completed) {
    updateData.replied_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('reviews')
    .update(updateData)
    .eq('id', reviewId)
    .eq('restaurant_id', review.restaurant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
