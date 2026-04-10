import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('stripe_customer_id')
    .eq('owner_email', user.email)
    .single()

  if (!restaurant?.stripe_customer_id) redirect('/dashboard')

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${process.env.VERCEL_URL}`

  const session = await getStripe().billingPortal.sessions.create({
    customer: restaurant.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/billing`,
  })

  redirect(session.url)
}
