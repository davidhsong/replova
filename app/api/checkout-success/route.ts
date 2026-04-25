import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

type Plan = 'starter' | 'growth' | 'agency'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) redirect('/dashboard')

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.status === 'complete') {
      const ownerEmail = session.metadata?.ownerEmail
      const rawPlan = session.metadata?.plan
      const plan: Plan = rawPlan === 'starter' || rawPlan === 'agency' ? rawPlan : 'growth'

      if (ownerEmail) {
        const admin = getSupabaseAdmin()
        await admin
          .from('accounts')
          .upsert(
            { owner_email: ownerEmail, stripe_customer_id: session.customer as string, plan },
            { onConflict: 'owner_email' }
          )
        await admin
          .from('restaurants')
          .update({ active: true })
          .eq('owner_email', ownerEmail)
      }
    }
  } catch {
    // Non-fatal — the webhook will catch any missed activations
  }

  redirect('/dashboard')
}
