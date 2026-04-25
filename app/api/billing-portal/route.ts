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
  if (!user) redirect('/signin')

  // stripe_customer_id lives on the accounts table now
  const { data: account } = await getSupabaseAdmin()
    .from('accounts')
    .select('stripe_customer_id')
    .eq('owner_email', user.email!)
    .maybeSingle()

  if (!account?.stripe_customer_id) redirect('/dashboard')

  const session = await getStripe().billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${BASE_URL}/dashboard/billing`,
  })

  redirect(session.url)
}
