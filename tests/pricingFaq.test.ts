import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PLAN_LIMITS } from '../lib/planLimits'
import {
  getActiveStripePriceId,
  getPricingConfiguration,
  getPublicPricingPlans,
  identifyPlanFromStripePrice,
  INTRO_MONTHLY_PRICES,
  LEGACY_MONTHLY_PRICES,
  type PricingEnvironment,
} from '../lib/pricing'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const configuredEnvironment: PricingEnvironment = {
  REPLOVA_INTRO_PRICING_ENABLED: 'false',
  STRIPE_PRICE_ID_STARTER: 'price_legacy_starter',
  STRIPE_PRICE_ID_GROWTH: 'price_legacy_growth',
  STRIPE_PRICE_ID_AGENCY: 'price_legacy_agency',
  STRIPE_PRICE_ID_STARTER_INTRO: 'price_intro_starter',
  STRIPE_PRICE_ID_GROWTH_INTRO: 'price_intro_growth',
  STRIPE_PRICE_ID_AGENCY_INTRO: 'price_intro_agency',
}

test('legacy pricing remains active until the intro feature flag is explicitly enabled', () => {
  const configuration = getPricingConfiguration(configuredEnvironment)
  assert.equal(configuration.status, 'available')
  assert.equal(configuration.mode, 'legacy')
  assert.equal(getActiveStripePriceId('growth', configuredEnvironment), 'price_legacy_growth')

  const publicPricing = getPublicPricingPlans(configuredEnvironment)
  assert.equal(publicPricing.status, 'available')
  if (publicPricing.status !== 'available') return
  assert.deepEqual(
    Object.fromEntries(publicPricing.plans.map(plan => [plan.key, plan.price])),
    LEGACY_MONTHLY_PRICES,
  )
})

test('the proposed 19, 49, and 99 intro prices activate only with a complete distinct catalog', () => {
  const environment = { ...configuredEnvironment, REPLOVA_INTRO_PRICING_ENABLED: 'true' }
  const configuration = getPricingConfiguration(environment)
  assert.equal(configuration.status, 'available')
  assert.equal(configuration.mode, 'intro')
  assert.equal(getActiveStripePriceId('starter', environment), 'price_intro_starter')
  assert.equal(getActiveStripePriceId('agency', environment), 'price_intro_agency')

  const publicPricing = getPublicPricingPlans(environment)
  assert.equal(publicPricing.status, 'available')
  if (publicPricing.status !== 'available') return
  assert.deepEqual(
    Object.fromEntries(publicPricing.plans.map(plan => [plan.key, plan.price])),
    INTRO_MONTHLY_PRICES,
  )
})

test('intro activation fails closed for missing, invalid, or duplicate Stripe Price IDs', () => {
  const missingLegacy = {
    ...configuredEnvironment,
    STRIPE_PRICE_ID_STARTER: '',
  }
  assert.equal(getPricingConfiguration(missingLegacy).status, 'unavailable')
  assert.throws(() => getActiveStripePriceId('starter', missingLegacy), /pricing is unavailable/i)

  const missing = {
    ...configuredEnvironment,
    REPLOVA_INTRO_PRICING_ENABLED: 'true',
    STRIPE_PRICE_ID_AGENCY_INTRO: '',
  }
  assert.equal(getPricingConfiguration(missing).status, 'unavailable')
  assert.throws(() => getActiveStripePriceId('agency', missing), /pricing is unavailable/i)

  const invalid = {
    ...configuredEnvironment,
    REPLOVA_INTRO_PRICING_ENABLED: 'true',
    STRIPE_PRICE_ID_GROWTH_INTRO: 'prod_not_a_price',
  }
  assert.equal(getPricingConfiguration(invalid).status, 'unavailable')

  const duplicate = {
    ...configuredEnvironment,
    REPLOVA_INTRO_PRICING_ENABLED: 'true',
    STRIPE_PRICE_ID_GROWTH_INTRO: 'price_intro_starter',
  }
  assert.equal(getPricingConfiguration(duplicate).status, 'unavailable')

  const reusedLegacy = {
    ...configuredEnvironment,
    REPLOVA_INTRO_PRICING_ENABLED: 'true',
    STRIPE_PRICE_ID_STARTER_INTRO: 'price_legacy_starter',
  }
  assert.equal(getPricingConfiguration(reusedLegacy).status, 'unavailable')
})

test('legacy and intro Stripe prices both resolve to the same durable plan entitlements', () => {
  for (const plan of ['starter', 'growth', 'agency'] as const) {
    assert.equal(identifyPlanFromStripePrice(`price_legacy_${plan}`, configuredEnvironment), plan)
    assert.equal(identifyPlanFromStripePrice(`price_intro_${plan}`, configuredEnvironment), plan)
  }

  assert.equal(identifyPlanFromStripePrice('price_unknown', configuredEnvironment), null)
  assert.equal(identifyPlanFromStripePrice('', configuredEnvironment), null)

  assert.deepEqual(PLAN_LIMITS.starter, {
    locations: 1,
    competitors: 3,
    sentiment: false,
    scores: false,
    pdfReports: false,
    persona: false,
    whitelabel: false,
  })
  assert.equal(PLAN_LIMITS.growth.locations, 5)
  assert.equal(PLAN_LIMITS.agency.locations, 15)
  assert.equal(PLAN_LIMITS.agency.whitelabel, true)
})

test('an ambiguous Stripe Price ID never grants a plan', () => {
  const ambiguous = {
    ...configuredEnvironment,
    STRIPE_PRICE_ID_GROWTH_INTRO: 'price_legacy_starter',
  }
  assert.equal(identifyPlanFromStripePrice('price_legacy_starter', ambiguous), null)
})

test('public plan claims match implemented controls and do not promise unattended publishing', () => {
  const pricing = getPublicPricingPlans(configuredEnvironment)
  assert.equal(pricing.status, 'available')
  if (pricing.status !== 'available') return

  const copy = JSON.stringify(pricing.plans)
  assert.match(copy, /manual approval/)
  assert.match(copy, /5 business locations/)
  assert.match(copy, /15 business locations/)
  assert.match(copy, /Custom reply persona/)
  assert.match(copy, /White-label PDF reports/)
  assert.doesNotMatch(copy, /auto-publish|unlimited|SMS|multi-client/i)
})

test('homepage omits public pricing while checkout keeps its server-side Stripe price resolver', async () => {
  const [page, marketingChrome, stripeSource, checkoutSource, changePlanSource, envExample] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'MarketingChrome.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'lib', 'stripe.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'api', 'create-checkout', 'route.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'app', 'api', 'change-plan', 'route.ts'), 'utf8'),
    readFile(path.join(repoRoot, '.env.example'), 'utf8'),
  ])

  assert.doesNotMatch(page, /HomePricing|id="pricing"|pricing-title/)
  assert.doesNotMatch(marketingChrome, /\/#pricing/)
  assert.match(stripeSource, /getActiveStripePriceId/)
  assert.match(stripeSource, /identifyPlanFromStripePrice/)
  assert.match(checkoutSource, /getStripePriceId\(plan\)/)
  assert.match(changePlanSource, /getStripePriceId\(plan\)/)
  assert.match(checkoutSource, /trial_period_days:\s*30/)
  assert.match(envExample, /REPLOVA_INTRO_PRICING_ENABLED=false/)
  assert.match(envExample, /STRIPE_PRICE_ID_STARTER_INTRO=/)
  assert.match(envExample, /STRIPE_PRICE_ID_GROWTH_INTRO=/)
  assert.match(envExample, /STRIPE_PRICE_ID_AGENCY_INTRO=/)
})

test('FAQ starts collapsed and remains a single-expanded accessible accordion with reduced-motion support', async () => {
  const [page, component, stylesheet] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'HomeFaq.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'marketing', 'HomeFaq.module.css'), 'utf8'),
  ])

  assert.match(page, /<HomeFaq\s*\/>/)
  assert.match(component, /useState<number \| null>\(null\)/)
  assert.match(component, /aria-expanded=\{isOpen\}/)
  assert.match(component, /aria-controls=\{panelId\}/)
  assert.match(component, /role="region"/)
  assert.match(component, /aria-labelledby=\{buttonId\}/)
  assert.match(component, /aria-hidden=\{!isOpen\}/)
  assert.match(component, /inert=\{!isOpen \? true : undefined\}/)
  assert.match(component, /A Google Business Profile is optional/i)
  assert.doesNotMatch(component, /enable delayed auto-reply/i)
  assert.match(stylesheet, /grid-template-rows:\s*0fr/)
  assert.match(stylesheet, /grid-template-rows:\s*1fr/)
  assert.match(stylesheet, /420ms cubic-bezier/)
  assert.match(stylesheet, /\.section\s*\{[^}]*background:\s*transparent/)
  assert.match(stylesheet, /prefers-reduced-motion:\s*reduce/)
  assert.match(stylesheet, /@media \(max-width: 560px\)/)
})

test('homepage replacement leaves its established non-pricing sections in place', async () => {
  const [page, marketingChrome] = await Promise.all([
    readFile(path.join(repoRoot, 'app', 'page.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'components', 'MarketingChrome.tsx'), 'utf8'),
  ])
  assert.match(page, /<MarketingHeader tapHome \/>/)
  assert.doesNotMatch(page, /<ProductPreview\s*\/>/)
  assert.match(page, /<VisitStory\s*\/>/)
  assert.match(page, /See what needs attention/)
  assert.match(page, /className="promise-section"/)
  assert.match(page, /className="security-section"/)
  assert.equal(page.match(/className="security-icon /g)?.length, 4)
  assert.match(page, /function GoogleIcon\(\)/)
  assert.match(page, /function OpenAIIcon\(\)/)
  assert.match(page, /<NavItemIcon name=\{industry\.icon\} \/>/)
  assert.match(marketingChrome, /export function NavItemIcon/)
  for (const icon of ['healthcare', 'retail', 'local']) {
    assert.match(page, new RegExp(`icon: '${icon}'`))
  }
  assert.match(page, /<MarketingFooter tapHome \/>/)
  assert.doesNotMatch(page, /const plans =/)
  assert.doesNotMatch(page, /const faqs =/)
})
