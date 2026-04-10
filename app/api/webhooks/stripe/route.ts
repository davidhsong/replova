import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
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
      const restaurantId = session.metadata?.restaurantId
      if (restaurantId) {
        await admin
          .from('restaurants')
          .update({ active: true, stripe_customer_id: session.customer as string })
          .eq('id', restaurantId)
      }
      break
    }

    // Subscription cancelled or ended (trial expired without payment method, etc.)
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await admin
        .from('restaurants')
        .update({ active: false })
        .eq('stripe_customer_id', sub.customer as string)
      break
    }

    // Payment failed — mark inactive so user sees the upgrade prompt
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.customer) {
        await admin
          .from('restaurants')
          .update({ active: false })
          .eq('stripe_customer_id', invoice.customer as string)
      }
      break
    }

    // Payment succeeded after a failure — reactivate
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      // Only reactivate for subscription invoices (not one-time)
      if (invoice.customer && (invoice as Stripe.Invoice & { subscription?: string }).subscription) {
        await admin
          .from('restaurants')
          .update({ active: true })
          .eq('stripe_customer_id', invoice.customer as string)
      }
      break
    }
  }

  return new Response(null, { status: 200 })
}
