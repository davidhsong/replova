import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateReplies } from '@/lib/generateReplies'
import { ACTIVE_LOCATION_COOKIE } from '@/lib/activeLocation'
import pLimit from 'p-limit'

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email)
    .single<{ plan: string }>()

  if (account?.plan !== 'agency') {
    return NextResponse.json({ error: 'Agency plan required' }, { status: 403 })
  }

  // Mirror the same restaurant resolution logic as the settings API (active location cookie first)
  let restaurantId: string | null = null
  let restaurantName: string | null = null

  const activeId = cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value
  if (activeId) {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, active')
      .eq('id', activeId)
      .eq('owner_email', user.email)
      .eq('active', true)
      .single<{ id: string; name: string }>()
    if (data) { restaurantId = data.id; restaurantName = data.name }
  }

  if (!restaurantId) {
    const { data } = await admin
      .from('restaurants')
      .select('id, name, active')
      .eq('owner_email', user.email)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; name: string }>()
    if (data) { restaurantId = data.id; restaurantName = data.name }
  }

  if (!restaurantId || !restaurantName) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  }

  const { data: settings } = await admin
    .from('restaurant_settings')
    .select('reply_persona')
    .eq('restaurant_id', restaurantId)
    .single<{ reply_persona: string | null }>()

  const persona = settings?.reply_persona ?? null

  // Regenerate all reviews not yet replied to
  const { data: reviews } = await admin
    .from('reviews')
    .select('id, author, rating, review_text')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'drafted'])
    .not('review_text', 'is', null)

  if (!reviews || reviews.length === 0) {
    return NextResponse.json({ regenerated: 0 })
  }

  const limit = pLimit(5)
  let regenerated = 0
  let failed = 0

  await Promise.all(
    reviews.map(review =>
      limit(async () => {
        try {
          const variants = await generateReplies({
            restaurantName,
            author: review.author ?? 'Guest',
            rating: review.rating ?? 5,
            reviewText: review.review_text ?? '',
            persona,
          })
          const { error } = await admin
            .from('reviews')
            .update({
              reply_draft_1: variants.professional,
              reply_draft_2: variants.warm,
              reply_draft_3: variants.brief,
            })
            .eq('id', review.id)
          if (error) {
            console.error('Failed to update review', review.id, error)
            failed++
          } else {
            regenerated++
          }
        } catch (err) {
          console.error('Failed to regenerate reply for review', review.id, err)
          failed++
        }
      })
    )
  )

  return NextResponse.json({ regenerated, failed })
}
