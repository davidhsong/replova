import Link from 'next/link'
import { getPublicPricingPlans } from '@/lib/pricing'
import styles from './HomePricing.module.css'

export function HomePricing() {
  const pricing = getPublicPricingPlans()

  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div>
            <div className={styles.eyebrow}>Pricing</div>
            <h2 id="pricing-title">Start with one location. Scale when you are ready.</h2>
          </div>
          <p>Clear plan limits, a 30-day trial, and manual control over every public reply.</p>
        </div>

        {pricing.status === 'unavailable' ? (
          <div className={styles.unavailable} role="status">
            <div>
              <span>Pricing update in progress</span>
              <h3>New subscriptions are temporarily paused.</h3>
              <p>We are finishing a billing configuration check before accepting a new plan selection.</p>
            </div>
            <Link href="/demo" className={styles.primaryButton}>Request a demo</Link>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {pricing.plans.map(plan => (
                <article
                  key={plan.key}
                  className={`${styles.card} ${plan.featured ? styles.featured : ''}`}
                >
                  <div className={styles.cardHeader}>
                    <span className={styles.planName}>{plan.name}</span>
                    {plan.featured && <span className={styles.recommended}>Recommended</span>}
                  </div>
                  <div className={styles.price}>
                    <strong>${plan.price}</strong>
                    <span>per month</span>
                  </div>
                  <p className={styles.description}>{plan.description}</p>
                  <ul>
                    {plan.features.map(feature => <li key={feature}>{feature}</li>)}
                  </ul>
                  <Link href="/onboard" className={plan.featured ? styles.primaryButton : styles.secondaryButton}>
                    Create account
                  </Link>
                </article>
              ))}
            </div>
            <p className={styles.disclosure}>
              Google Business features require an authorized connection and available API access. Unattended publishing is not included.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
