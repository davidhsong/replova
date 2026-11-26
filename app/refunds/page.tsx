import type { Metadata } from 'next'
import LegalLayout from '@/components/LegalLayout'
import type { LegalSection } from '@/components/LegalLayout'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Refund Policy',
  description: 'Review Replova trial, cancellation, downgrade, and refund terms for paid subscriptions.',
  path: '/refunds',
})

const sections: LegalSection[] = [
  {
    heading: 'Trial',
    content: (
      <p>
        Eligible new customers receive a <strong style={{ color: 'var(--t1)' }}>30-day free trial</strong>. You will not
        be charged anything during the trial period. You can cancel at any time before the trial ends and owe
        nothing. Your first charge occurs only after the 30-day trial expires.
      </p>
    ),
  },
  {
    heading: 'Cancellations',
    content: (
      <p>
        To stop renewal and keep access through the end of your paid period, use the Billing page in your dashboard.
        To end access early and receive a prorated refund, email{' '}
        <a href="mailto:support@replova.app?subject=Prorated%20cancellation%20refund">support@replova.app</a>{' '}
        from your account email and ask to cancel immediately. There is no cancellation fee.
      </p>
    ),
  },
  {
    heading: 'How we calculate your refund',
    content: (
      <>
        <p style={{ marginBottom: 12 }}>
          We refund the portion of your subscription payment that covers the time remaining in your paid billing period
          when we receive your immediate cancellation request. We use the amount you actually paid after discounts.
          For example, if you paid $39 for 30 days and exactly 10 days remain, your refund is $13.
        </p>
        <p>
          Support ends your access and issues the refund to your original payment method. You can request this at any
          point during the paid period. If you keep access until the period ends, there is no unused time to refund.
        </p>
      </>
    ),
  },
  {
    heading: 'Billing errors and service outages',
    content: (
      <>
        <p style={{ marginBottom: 10 }}>We will consider refunds on a case-by-case basis if:</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 0, marginBottom: 12 }}>
          {[
            'You were charged in error (e.g., a duplicate charge or billing system error)',
            'A verified service outage prevented you from using Replova for a substantial portion of a billing period and we were unable to resolve it in a reasonable time',
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
    heading: 'Earlier charges',
    content: (
      <p>
        The prorated cancellation policy applies to charges made on or after November 26, 2026, Pacific time.
        For earlier charges, we honor the terms in effect when you paid, including the full-month refund for
        accidental cancellation within seven days of the charge. Email support with your account email and charge date.
      </p>
    ),
  },
  {
    heading: 'Plan downgrades',
    content: (
      <p>
        You can change your plan through Billing. Review the effective date and any prorated charge or credit
        shown before confirming the change.
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
      kicker="Refund Policy"
      sections={sections}
    />
  )
}
