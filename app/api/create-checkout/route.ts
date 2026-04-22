import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BASE_URL } from '@/lib/baseUrl'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/onboard')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant) redirect('/onboard')

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    customer_email: user.email!,
    metadata: { restaurantId: restaurant.id },
    subscription_data: { trial_period_days: 30 },
    success_url: `${BASE_URL}/dashboard?success=true`,
    cancel_url: `${BASE_URL}/dashboard`,
  })

  redirect(session.url!)
}
