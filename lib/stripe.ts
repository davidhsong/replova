import Stripe from 'stripe'
import type { Plan } from '@/lib/planLimits'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured')
  if (!stripe) stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
  return stripe
}

export function getStripePriceId(plan: Plan): string {
  const priceIds: Record<Plan, string | undefined> = {
    starter: process.env.STRIPE_PRICE_ID_STARTER,
    growth: process.env.STRIPE_PRICE_ID_GROWTH ?? process.env.STRIPE_PRICE_ID,
    agency: process.env.STRIPE_PRICE_ID_AGENCY,
  }
  const priceId = priceIds[plan]
  if (!priceId) throw new Error(`Stripe price is not configured for the ${plan} plan`)
  return priceId
}

export function getPlanFromStripePrice(priceId: string): Plan | null {
  const plans: Plan[] = ['starter', 'growth', 'agency']
  for (const plan of plans) {
    try {
      if (getStripePriceId(plan) === priceId) return plan
    } catch {
      // A missing unrelated price must not stop webhook processing.
    }
  }
  return null
}

export function subscriptionGrantsAccess(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing'
}
