import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function POST() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // stripe_customer_id lives on accounts, not restaurants
  const { data: account } = await admin
    .from('accounts')
    .select('stripe_customer_id')
    .eq('owner_email', user.email!)
    .maybeSingle()

  if (account?.stripe_customer_id) {
    try {
      const stripe = getStripe()
      // status: 'active' misses trialing subscriptions — every new signup starts
      // in trialing, so deleting an account mid-trial would leave the
      // subscription running and charge the (now-deleted) customer later.
      const subscriptions = await stripe.subscriptions.list({
        customer: account.stripe_customer_id,
        status: 'all',
      })
      const cancelable = subscriptions.data.filter(
        sub => sub.status !== 'canceled' && sub.status !== 'incomplete_expired'
      )
      await Promise.all(
        cancelable.map(sub => stripe.subscriptions.cancel(sub.id))
      )
    } catch (err) {
      console.error('[account/delete] Stripe cancellation failed:', err)
    }
  }

  // Get all restaurants owned by this user
  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email!)

  const restaurantIds = (restaurants ?? []).map(r => r.id)

  if (restaurantIds.length > 0) {
    // Get competitor IDs so we can delete their snapshots
    const { data: competitors } = await admin
      .from('competitors')
      .select('id')
      .in('restaurant_id', restaurantIds)

    const competitorIds = (competitors ?? []).map(c => c.id)
    if (competitorIds.length > 0) {
      await admin.from('competitor_snapshots').delete().in('competitor_id', competitorIds)
    }

    // Delete all child rows before restaurants (FK constraints)
    await admin.from('review_requests').delete().in('restaurant_id', restaurantIds)
    await admin.from('reply_queue').delete().in('restaurant_id', restaurantIds)
    await admin.from('reputation_scores').delete().in('restaurant_id', restaurantIds)
    await admin.from('competitors').delete().in('restaurant_id', restaurantIds)
    await admin.from('restaurant_settings').delete().in('restaurant_id', restaurantIds)
    await admin.from('reviews').delete().in('restaurant_id', restaurantIds)
    await admin.from('restaurants').delete().in('id', restaurantIds)
  }

  await admin.from('accounts').delete().eq('owner_email', user.email!)

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[account/delete] Failed to delete auth user:', deleteUserError.message)
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
