import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'

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
      return NextResponse.json(
        { error: 'We could not cancel your subscription, so nothing was deleted. Please try again or contact support.' },
        { status: 502 }
      )
    }
  }

  // Get all restaurants owned by this user
  const { data: restaurants, error: restaurantsError } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email!)
  if (restaurantsError) {
    return NextResponse.json({ error: 'Unable to load account data for deletion.' }, { status: 500 })
  }

  const restaurantIds = (restaurants ?? []).map(r => r.id)

  if (restaurantIds.length > 0) {
    // Get competitor IDs so we can delete their snapshots
    const { data: competitors, error: competitorsError } = await admin
      .from('competitors')
      .select('id')
      .in('restaurant_id', restaurantIds)
    if (competitorsError) {
      return NextResponse.json({ error: 'Unable to load competitor data for deletion.' }, { status: 500 })
    }

    const competitorIds = (competitors ?? []).map(c => c.id)
    if (competitorIds.length > 0) {
      const { error } = await admin.from('competitor_snapshots').delete().in('competitor_id', competitorIds)
      if (error) return NextResponse.json({ error: 'Unable to delete competitor history.' }, { status: 500 })
    }

    // Delete all child rows before restaurants (FK constraints)
    for (const table of ['review_requests', 'reply_queue', 'reputation_scores', 'competitors', 'restaurant_settings', 'reviews'] as const) {
      const { error } = await admin.from(table).delete().in('restaurant_id', restaurantIds)
      if (error) {
        console.error(`[account/delete] Failed deleting ${table}:`, error)
        return NextResponse.json({ error: 'Account deletion could not be completed. Please contact support.' }, { status: 500 })
      }
    }
    const { error: restaurantDeleteError } = await admin.from('restaurants').delete().in('id', restaurantIds)
    if (restaurantDeleteError) {
      return NextResponse.json({ error: 'Unable to delete restaurant data.' }, { status: 500 })
    }
  }

  const { error: accountDeleteError } = await admin.from('accounts').delete().eq('owner_email', user.email!)
  if (accountDeleteError) {
    return NextResponse.json({ error: 'Unable to delete the account record.' }, { status: 500 })
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[account/delete] Failed to delete auth user:', deleteUserError.message)
    // The account and all customer data are gone, so treat this as complete
    // from the customer's perspective; the orphaned auth identity cannot pass
    // the account lookup used by the magic-link route.
    return NextResponse.json({ success: true, warning: 'Authentication cleanup is pending.' })
  }

  return NextResponse.json({ success: true })
}
