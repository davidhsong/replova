import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

type Plan = 'starter' | 'growth' | 'agency'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getPlanFromPriceId(priceId: string): Plan | null {
  const starter = process.env.STRIPE_PRICE_ID_STARTER
  const growth = process.env.STRIPE_PRICE_ID_GROWTH || process.env.STRIPE_PRICE_ID
  const agency = process.env.STRIPE_PRICE_ID_AGENCY
  if (starter && priceId === starter) return 'starter'
  if (growth && priceId === growth) return 'growth'
  if (agency && priceId === agency) return 'agency'
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  switch (event.type) {
    // Trial started / subscription activated after checkout
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const ownerEmail = session.metadata?.ownerEmail
      const rawPlan = session.metadata?.plan
      const plan: Plan = rawPlan === 'starter' || rawPlan === 'agency' ? rawPlan : 'growth'

      if (ownerEmail) {
        // Update the accounts row with stripe_customer_id and plan
        await admin
          .from('accounts')
          .upsert(
            { owner_email: ownerEmail, stripe_customer_id: session.customer as string, plan },
            { onConflict: 'owner_email' }
          )

        // Activate all restaurants for this owner
        await admin
          .from('restaurants')
          .update({ active: true })
          .eq('owner_email', ownerEmail)
      }
      break
    }

    // User changed plan via billing portal
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price?.id
      if (priceId) {
        const plan = getPlanFromPriceId(priceId)
        if (plan) {
          await admin
            .from('accounts')
            .update({ plan })
            .eq('stripe_customer_id', sub.customer as string)
        }
      }
      break
    }

    // Subscription cancelled or ended
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      // Look up account to get owner_email, then deactivate all their restaurants
      const { data: account } = await admin
        .from('accounts')
        .select('owner_email')
        .eq('stripe_customer_id', sub.customer as string)
        .maybeSingle()

      if (account?.owner_email) {
        await admin
          .from('restaurants')
          .update({ active: false })
          .eq('owner_email', account.owner_email)
      }
      break
    }

    // Payment failed — mark inactive
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer) {
        const { data: account } = await admin
          .from('accounts')
          .select('owner_email')
          .eq('stripe_customer_id', invoice.customer as string)
          .maybeSingle()

        if (account?.owner_email) {
          await admin
            .from('restaurants')
            .update({ active: false })
            .eq('owner_email', account.owner_email)
        }
      }
      break
    }

    // Payment succeeded after a failure — reactivate
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer && (invoice as Stripe.Invoice & { subscription?: string }).subscription) {
        const { data: account } = await admin
          .from('accounts')
          .select('owner_email')
          .eq('stripe_customer_id', invoice.customer as string)
          .maybeSingle()

        if (account?.owner_email) {
          await admin
            .from('restaurants')
            .update({ active: true })
            .eq('owner_email', account.owner_email)
        }
      }
      break
    }
  }

  return new Response(null, { status: 200 })
}
