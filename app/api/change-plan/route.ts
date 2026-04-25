import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Plan = 'starter' | 'growth' | 'agency'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getPriceId(plan: Plan): string | null {
  const map: Record<Plan, string | undefined> = {
    starter: process.env.STRIPE_PRICE_ID_STARTER,
    growth:  process.env.STRIPE_PRICE_ID_GROWTH || process.env.STRIPE_PRICE_ID,
    agency:  process.env.STRIPE_PRICE_ID_AGENCY,
  }
  return map[plan] ?? null
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { plan?: string }
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

  const newPriceId = getPriceId(plan)
  if (!newPriceId) {
    return NextResponse.json({ error: 'Price not configured for this plan.' }, { status: 500 })
  }

  const stripe = getStripe()

  const { data: subs } = await stripe.subscriptions.list({
    customer: account.stripe_customer_id,
    status: 'all',
    limit: 10,
  })

  const sub = subs.find(s => s.status !== 'canceled')
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
  await admin
    .from('accounts')
    .update({ plan })
    .eq('owner_email', user.email!)

  return NextResponse.json({ success: true })
}
