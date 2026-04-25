import type { Metadata } from 'next'
import LegalLayout from '@/components/LegalLayout'
import type { LegalSection } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'Refund Policy — Replova' }

const sections: LegalSection[] = [
  {
    heading: 'Trial',
    content: (
      <p>
        All Replova plans include a <strong style={{ color: 'var(--t1)' }}>30-day free trial</strong>. You will not
        be charged anything during the trial period. You can cancel at any time before the trial ends and owe
        nothing. Your first charge occurs only after the 30-day trial expires.
      </p>
    ),
  },
  {
    heading: 'Cancellations',
    content: (
      <p>
        You may cancel at any time through the <strong style={{ color: 'var(--t1)' }}>Billing page</strong> in your
        dashboard. Cancellation takes effect at the end of your current billing period — you retain full access to
        all features until then. No cancellation fees.
      </p>
    ),
  },
  {
    heading: 'Refunds on paid subscriptions',
    content: (
      <>
        <p style={{ marginBottom: 12 }}>
          Because Replova begins delivering value immediately upon activation,{' '}
          <strong style={{ color: 'var(--t1)' }}>we do not issue refunds for partial billing periods</strong>{' '}
          or for months already charged.
        </p>
        <p>
          If you are billed on the 1st of the month and cancel on the 15th, your subscription remains active
          through the end of that month and no refund is issued for the unused days.
        </p>
      </>
    ),
  },
  {
    heading: 'Exceptions',
    content: (
      <>
        <p style={{ marginBottom: 10 }}>We will consider refunds on a case-by-case basis if:</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 0, marginBottom: 12 }}>
          {[
            'You were charged in error (e.g., a duplicate charge or billing system error)',
            'A verified service outage prevented you from using Replova for a substantial portion of a billing period and we were unable to resolve it in a reasonable time',
            'You contacted us within 7 days of a charge and had not meaningfully used the service since the last billing cycle',
          ].map(item => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--t4)', flexShrink: 0, marginTop: 9 }} />
              {item}
            </li>
          ))}
        </ul>
        <p>
          To request an exception, email{' '}
          <a href="mailto:support@replova.app" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>support@replova.app</a>{' '}
          within <strong style={{ color: 'var(--t1)' }}>14 days</strong> of the charge. Include your account email
          and a brief description of the issue. We respond to all refund requests within 3 business days.
        </p>
      </>
    ),
  },
  {
    heading: 'Cancel by mistake',
    content: (
      <p>
        If you cancel within 7 days of being charged and email us, we&apos;ll refund the full month, no questions.
      </p>
    ),
  },
  {
    heading: 'Plan downgrades',
    content: (
      <p>
        You can downgrade your plan at any time via the billing portal. The lower-tier pricing takes effect at
        the start of your next billing cycle. We do not issue credits or refunds for the price difference mid-cycle.
      </p>
    ),
  },
  {
    heading: 'Chargebacks',
    content: (
      <p>
        If you believe a charge was made in error, please contact us at{' '}
        <a href="mailto:support@replova.app" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>support@replova.app</a>{' '}
        before initiating a chargeback with your bank. We will work quickly to resolve the issue directly.
        Initiating a chargeback without first contacting us may result in suspension of your account while the
        dispute is under review.
      </p>
    ),
  },
]

export default function RefundPage() {
  return (
    <LegalLayout
      page="refunds"
      title="Refunds"
      kicker="Plain English"
      sections={sections}
    />
  )
}
