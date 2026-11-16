import type { Plan } from '@/lib/planLimits'

export type PricingEnvironment = Partial<Record<string, string | undefined>>
export type PricingMode = 'legacy' | 'intro'

export const PLAN_ORDER: readonly Plan[] = ['starter', 'growth', 'agency']

export const LEGACY_MONTHLY_PRICES: Readonly<Record<Plan, number>> = {
  starter: 39,
  growth: 99,
  agency: 199,
}

export const INTRO_MONTHLY_PRICES: Readonly<Record<Plan, number>> = {
  starter: 19,
  growth: 49,
  agency: 99,
}

const LEGACY_PRICE_ENV: Readonly<Record<Plan, string>> = {
  starter: 'STRIPE_PRICE_ID_STARTER',
  growth: 'STRIPE_PRICE_ID_GROWTH',
  agency: 'STRIPE_PRICE_ID_AGENCY',
}

const INTRO_PRICE_ENV: Readonly<Record<Plan, string>> = {
  starter: 'STRIPE_PRICE_ID_STARTER_INTRO',
  growth: 'STRIPE_PRICE_ID_GROWTH_INTRO',
  agency: 'STRIPE_PRICE_ID_AGENCY_INTRO',
}

export const PLAN_MARKETING: Readonly<Record<Plan, {
  name: string
  description: string
  features: readonly string[]
  featured: boolean
}>> = {
  starter: {
    name: 'Starter',
    description: 'Core review workflows for one independent business.',
    features: [
      '1 business location',
      'AI reply drafts with manual approval',
      'Low-rating email alerts',
      'Weekly owner digest',
      'CSV review-request emails',
    ],
    featured: false,
  },
  growth: {
    name: 'Growth',
    description: 'Deeper analysis and more location capacity.',
    features: [
      'Up to 5 business locations',
      'Reputation score and sentiment analysis',
      'Competitor tracking (5 per location)',
      'Monthly PDF report',
      'Everything in Starter',
    ],
    featured: true,
  },
  agency: {
    name: 'Agency',
    description: 'Higher limits and branded reporting for larger operators.',
    features: [
      'Up to 15 business locations',
      'Custom reply persona',
      'White-label PDF reports',
      'Competitor tracking (10 per location)',
      'Everything in Growth',
    ],
    featured: false,
  },
}

type PriceIdSet = Record<Plan, string | undefined>

export type PricingConfiguration =
  | { status: 'available'; mode: PricingMode; priceIds: Record<Plan, string> }
  | { status: 'unavailable'; mode: PricingMode; reasons: readonly string[] }

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true'
}

function readPriceIds(
  env: PricingEnvironment,
  names: Readonly<Record<Plan, string>>,
  useLegacyGrowthFallback = false,
): PriceIdSet {
  return {
    starter: env[names.starter]?.trim() || undefined,
    growth:
      env[names.growth]?.trim()
      || (useLegacyGrowthFallback ? env.STRIPE_PRICE_ID?.trim() : undefined)
      || undefined,
    agency: env[names.agency]?.trim() || undefined,
  }
}

function validateSelectedIds(ids: PriceIdSet, label: string): string[] {
  const reasons: string[] = []

  for (const plan of PLAN_ORDER) {
    const value = ids[plan]
    if (!value) reasons.push(`${label} ${plan} price is missing`)
    else if (!value.startsWith('price_')) reasons.push(`${label} ${plan} price is invalid`)
  }

  const configured = PLAN_ORDER.map(plan => ids[plan]).filter((value): value is string => Boolean(value))
  if (new Set(configured).size !== configured.length) {
    reasons.push(`${label} price IDs must be unique`)
  }

  return reasons
}

function isComplete(ids: PriceIdSet): ids is Record<Plan, string> {
  return PLAN_ORDER.every(plan => Boolean(ids[plan]))
}

export function getAllConfiguredStripePriceIds(env: PricingEnvironment = process.env): {
  legacy: PriceIdSet
  intro: PriceIdSet
} {
  return {
    legacy: readPriceIds(env, LEGACY_PRICE_ENV, true),
    intro: readPriceIds(env, INTRO_PRICE_ENV),
  }
}

export function getPricingConfiguration(env: PricingEnvironment = process.env): PricingConfiguration {
  const introEnabled = isEnabled(env.REPLOVA_INTRO_PRICING_ENABLED)
  const mode: PricingMode = introEnabled ? 'intro' : 'legacy'
  const { legacy, intro } = getAllConfiguredStripePriceIds(env)
  const selected = introEnabled ? intro : legacy
  const reasons = validateSelectedIds(selected, mode)

  if (introEnabled) {
    reasons.push(...validateSelectedIds(legacy, 'legacy'))

    if (isComplete(legacy) && isComplete(intro)) {
      const combined = [...PLAN_ORDER.map(plan => legacy[plan]), ...PLAN_ORDER.map(plan => intro[plan])]
      if (new Set(combined).size !== combined.length) {
        reasons.push('legacy and intro price IDs must be distinct')
      }
    }
  }

  if (reasons.length > 0 || !isComplete(selected)) {
    return { status: 'unavailable', mode, reasons: [...new Set(reasons)] }
  }

  return { status: 'available', mode, priceIds: selected }
}

export function getPublicPricingPlans(env: PricingEnvironment = process.env) {
  const configuration = getPricingConfiguration(env)
  if (configuration.status === 'unavailable') return configuration

  const prices = configuration.mode === 'intro' ? INTRO_MONTHLY_PRICES : LEGACY_MONTHLY_PRICES
  return {
    ...configuration,
    plans: PLAN_ORDER.map(plan => ({
      key: plan,
      price: prices[plan],
      ...PLAN_MARKETING[plan],
    })),
  }
}

export function getActiveStripePriceId(plan: Plan, env: PricingEnvironment = process.env): string {
  const configuration = getPricingConfiguration(env)
  if (configuration.status === 'unavailable') {
    throw new Error(`Stripe pricing is unavailable: ${configuration.reasons.join('; ')}`)
  }
  return configuration.priceIds[plan]
}

export function identifyPlanFromStripePrice(
  priceId: string,
  env: PricingEnvironment = process.env,
): Plan | null {
  if (!priceId) return null

  const { legacy, intro } = getAllConfiguredStripePriceIds(env)
  const matches = PLAN_ORDER.filter(plan => legacy[plan] === priceId || intro[plan] === priceId)
  return matches.length === 1 ? matches[0] : null
}
