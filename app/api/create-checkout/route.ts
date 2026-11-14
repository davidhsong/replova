import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'
import { getStripe, getStripePriceId } from '@/lib/stripe'
import type { Plan } from '@/lib/planLimits'
import { getAccountForAuthUser } from '@/lib/accountAccess'

function resolvePlan(raw: string | null): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) redirect('/onboard')

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (!account) redirect('/onboard/workspace')

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', account.owner_email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const queryPlan = req.nextUrl.searchParams.get('plan')
  const plan = queryPlan ? resolvePlan(queryPlan) : resolvePlan(account.plan)
  const stripe = getStripe()

  // An existing live subscription should be managed rather than duplicated.
  if (account.stripe_customer_id) {
    const subscriptions = await stripe.subscriptions.list({
      customer: account.stripe_customer_id,
      status: 'all',
      limit: 10,
    })
    if (subscriptions.data.some(subscription =>
      subscription.status !== 'canceled' && subscription.status !== 'incomplete_expired'
    )) {
      redirect('/api/billing-portal')
    }
  }

  const subscriptionData = {
    metadata: { ownerEmail: account.owner_email, accountId: account.id, plan },
    ...(account.stripe_customer_id ? {} : { trial_period_days: 30 }),
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
    ...(account.stripe_customer_id
      ? { customer: account.stripe_customer_id }
      : { customer_email: account.owner_email }),
    client_reference_id: restaurant?.id ?? account.id,
    metadata: {
      accountId: account.id,
      ...(restaurant ? { restaurantId: restaurant.id } : {}),
      ownerEmail: account.owner_email,
      plan,
    },
    subscription_data: subscriptionData,
    allow_promotion_codes: true,
    success_url: `${BASE_URL}/api/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE_URL}/dashboard/billing`,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')
  redirect(session.url)
}
