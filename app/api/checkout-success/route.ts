import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlanFromStripePrice, getStripe, subscriptionGrantsAccess } from '@/lib/stripe'
import { setOwnerRestaurantAccess } from '@/lib/subscriptionAccess'
import { getAccountForAuthUser } from '@/lib/accountAccess'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.redirect(new URL('/dashboard', req.url))

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.redirect(new URL('/signin?next=%2Fdashboard', req.url))
  }

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account) {
    return NextResponse.redirect(new URL('/onboard/workspace', req.url))
  }

  try {
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const ownerEmail = session.metadata?.ownerEmail?.toLowerCase()
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id

    if (
      session.status !== 'complete' ||
      session.mode !== 'subscription' ||
      !ownerEmail ||
      ownerEmail !== account.owner_email.toLowerCase() ||
      (session.metadata?.accountId && session.metadata.accountId !== account.id) ||
      !customerId ||
      !session.subscription
    ) {
      return NextResponse.redirect(new URL('/dashboard/billing?billing_error=invalid_checkout', req.url))
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (!subscriptionGrantsAccess(subscription.status)) {
      return NextResponse.redirect(new URL('/dashboard/billing?billing_error=inactive_subscription', req.url))
    }

    const plan = getPlanFromStripePrice(subscription.items.data[0]?.price.id ?? '')
    if (!plan) {
      return NextResponse.redirect(new URL('/dashboard/billing?billing_error=invalid_checkout', req.url))
    }
    const { error: accountError } = await admin
      .from('accounts')
      .update({ stripe_customer_id: customerId, plan })
      .eq('id', account.id)

    if (accountError) throw accountError

    await setOwnerRestaurantAccess(ownerEmail, true, plan)
    return NextResponse.redirect(new URL('/dashboard?success=true', req.url))
  } catch (err) {
    console.error('[checkout-success] Failed to reconcile checkout:', err)
    return NextResponse.redirect(new URL('/dashboard/billing?billing_error=checkout_sync', req.url))
  }
}
