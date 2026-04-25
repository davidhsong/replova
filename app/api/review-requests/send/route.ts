import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendReviewRequestEmail } from '@/lib/reviewRequests'

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  const body = await req.json() as { restaurantId?: string; requestIds?: string[] }

  if (body.restaurantId && body.restaurantId !== restaurant.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let query = admin
    .from('review_requests')
    .select('id, customer_name, customer_email, review_link')
    .eq('restaurant_id', restaurant.id)

  if (body.requestIds?.length) {
    query = query.in('id', body.requestIds)
  } else {
    query = query.eq('status', 'pending')
  }

  const { data: requests } = await query

  if (!requests?.length) {
    return NextResponse.json({ sent: 0, errors: [] })
  }

  let sent = 0
  const errors: string[] = []

  for (const request of requests) {
    try {
      await sendReviewRequestEmail(
        {
          id: request.id,
          customer_name: request.customer_name,
          customer_email: request.customer_email,
          review_link: request.review_link,
        },
        restaurant.name
      )
      await admin
        .from('review_requests')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', request.id)
      sent++
    } catch (err) {
      errors.push(`${request.customer_email}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    if (sent + errors.length < requests.length) {
      await delay(300)
    }
  }

  return NextResponse.json({ sent, errors })
}
