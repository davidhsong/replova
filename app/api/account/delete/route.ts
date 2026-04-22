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

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, stripe_customer_id')
    .eq('owner_email', user.email)
    .single()

  if (restaurant?.stripe_customer_id) {
    try {
      const stripe = getStripe()
      // Cancel all active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: restaurant.stripe_customer_id,
        status: 'active',
      })
      await Promise.all(
        subscriptions.data.map(sub =>
          stripe.subscriptions.cancel(sub.id)
        )
      )
    } catch (err) {
      console.error('[account/delete] Stripe cancellation failed:', err)
      // Proceed with deletion even if Stripe fails — Stripe webhook will handle edge cases
    }
  }

  if (restaurant) {
    // Delete all reviews for this restaurant first (FK constraint)
    await admin.from('reviews').delete().eq('restaurant_id', restaurant.id)
    await admin.from('restaurants').delete().eq('id', restaurant.id)
  }

  // Delete the Supabase auth user
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
  if (deleteUserError) {
    console.error('[account/delete] Failed to delete auth user:', deleteUserError.message)
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
