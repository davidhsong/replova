import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlanFromStripePrice, getStripe, subscriptionGrantsAccess } from '@/lib/stripe'
import type { Plan } from '@/lib/planLimits'
import { setOwnerRestaurantAccess } from '@/lib/subscriptionAccess'

function resolvePlan(raw: string | undefined): Plan {
  if (raw === 'starter' || raw === 'agency') return raw
  return 'growth'
}

async function setOwnerAccess(customerId: string, active: boolean): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data: account, error: accountError } = await admin
    .from('accounts')
    .select('owner_email, plan')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  if (accountError) throw accountError
  if (!account) return

  await setOwnerRestaurantAccess(
    account.owner_email,
    active,
    resolvePlan(account.plan)
  )
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !webhookSecret) {
    return new Response('Webhook is not configured', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 })
  }

  try {
    const admin = getSupabaseAdmin()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const ownerEmail = session.metadata?.ownerEmail?.toLowerCase()
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        if (!ownerEmail || !customerId || !subscriptionId || session.mode !== 'subscription') break
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

        const { error: accountError } = await admin.from('accounts').upsert(
          {
            owner_email: ownerEmail,
            stripe_customer_id: customerId,
            plan: resolvePlan(session.metadata?.plan),
          },
          { onConflict: 'owner_email' }
        )
        if (accountError) throw accountError

        await setOwnerRestaurantAccess(
          ownerEmail,
          subscriptionGrantsAccess(subscription.status),
          resolvePlan(session.metadata?.plan)
        )
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id
        const plan = getPlanFromStripePrice(subscription.items.data[0]?.price.id ?? '')
        if (plan) {
          const { error } = await admin
            .from('accounts')
            .update({ plan })
            .eq('stripe_customer_id', customerId)
          if (error) throw error
        }
        await setOwnerAccess(customerId, subscriptionGrantsAccess(subscription.status))
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id
        await setOwnerAccess(customerId, false)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const subscriptionRef = invoice.parent?.subscription_details?.subscription
        const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id
        if (subscriptionId) {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id
          await setOwnerAccess(customerId, subscriptionGrantsAccess(subscription.status))
        }
        break
      }

      case 'invoice.payment_failed': {
        // Keep access decisions aligned with the subscription status. Stripe can
        // retry failed invoices, so one failed attempt should not automatically
        // override an otherwise trialing/active subscription.
        const invoice = event.data.object
        const subscriptionId = invoice.parent?.subscription_details?.subscription
        if (typeof subscriptionId === 'string') {
          const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id
          await setOwnerAccess(customerId, subscriptionGrantsAccess(subscription.status))
        }
        break
      }
    }
  } catch (err) {
    console.error(`[stripe-webhook] ${event.type} failed:`, err)
    // A non-2xx response makes Stripe retry instead of silently losing access changes.
    return new Response('Webhook processing failed', { status: 500 })
  }

  return new Response(null, { status: 200 })
}
