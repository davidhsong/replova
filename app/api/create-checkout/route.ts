import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'

type Plan = 'starter' | 'growth' | 'agency'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getPriceId(plan: Plan): string {
  if (plan === 'starter') {
    return process.env.STRIPE_PRICE_ID_STARTER || process.env.STRIPE_PRICE_ID!
  }
  if (plan === 'agency') {
    return process.env.STRIPE_PRICE_ID_AGENCY || process.env.STRIPE_PRICE_ID!
  }
  return process.env.STRIPE_PRICE_ID_GROWTH || process.env.STRIPE_PRICE_ID!
}

function resolvePlan(raw: string | null): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/onboard')

  const admin = getSupabaseAdmin()

  // Get the first restaurant for this user (just need the id)
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .eq('owner_email', user.email)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!restaurant) redirect('/onboard')

  // Get the account for plan info
  const { data: account } = await admin
    .from('accounts')
    .select('plan')
    .eq('owner_email', user.email!)
    .maybeSingle()

  const queryPlan = req.nextUrl.searchParams.get('plan')
  const plan: Plan = queryPlan ? resolvePlan(queryPlan) : resolvePlan(account?.plan ?? null)

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: getPriceId(plan), quantity: 1 }],
    customer_email: user.email!,
    metadata: { restaurantId: restaurant.id, ownerEmail: user.email!, plan },
    subscription_data: { trial_period_days: 30 },
    success_url: `${BASE_URL}/dashboard?success=true`,
    cancel_url: `${BASE_URL}/dashboard`,
  })

  redirect(session.url!)
}
