import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getStripe, getStripePriceId, subscriptionGrantsAccess } from '@/lib/stripe'
import { setOwnerRestaurantAccess } from '@/lib/subscriptionAccess'

type Plan = 'starter' | 'growth' | 'agency'

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { plan?: string } | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  const plan = body.plan as Plan
  if (!['starter', 'growth', 'agency'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data: account } = await admin
    .from('accounts')
    .select('stripe_customer_id, plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  if (!account?.stripe_customer_id) {
    return NextResponse.json({ error: 'No active subscription found.' }, { status: 400 })
  }

  if (account.plan === plan) {
    return NextResponse.json({ error: 'Already on this plan.' }, { status: 400 })
  }

  let newPriceId: string
  try {
    newPriceId = getStripePriceId(plan)
  } catch {
    return NextResponse.json({ error: 'Price not configured for this plan.' }, { status: 500 })
  }

  const stripe = getStripe()

  const { data: subs } = await stripe.subscriptions.list({
    customer: account.stripe_customer_id,
    status: 'all',
    limit: 10,
  })

  const sub = subs.find(s => subscriptionGrantsAccess(s.status) || s.status === 'past_due')
  if (!sub) {
    return NextResponse.json({ error: 'No active subscription found. If you are still in a free trial, use the plan selector on the dashboard.' }, { status: 400 })
  }

  const itemId = sub.items?.data?.[0]?.id
  if (!itemId) {
    return NextResponse.json({ error: 'Could not read subscription details from Stripe.' }, { status: 500 })
  }

  await stripe.subscriptions.update(sub.id, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: 'create_prorations',
  })

  // Update immediately — webhook will confirm shortly after
  const { error: updateError } = await admin
    .from('accounts')
    .update({ plan })
    .eq('owner_email', user.email!)
  if (updateError) {
    console.error('Stripe plan changed but account update failed:', updateError)
    return NextResponse.json({ error: 'Plan changed in Stripe but the dashboard is still updating. Refresh shortly.' }, { status: 202 })
  }
  await setOwnerRestaurantAccess(user.email!, true, plan)

  return NextResponse.json({ success: true })
}
