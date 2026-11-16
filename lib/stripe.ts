import Stripe from 'stripe'
import type { Plan } from '@/lib/planLimits'
import { getActiveStripePriceId, identifyPlanFromStripePrice } from '@/lib/pricing'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe is not configured')
  if (!stripe) stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
  return stripe
}

export function getStripePriceId(plan: Plan): string {
  return getActiveStripePriceId(plan)
}

export function getPlanFromStripePrice(priceId: string): Plan | null {
  return identifyPlanFromStripePrice(priceId)
}

export function subscriptionGrantsAccess(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing'
}
