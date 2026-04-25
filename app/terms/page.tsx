import type { Metadata } from 'next'
import LegalLayout from '@/components/LegalLayout'
import type { LegalSection } from '@/components/LegalLayout'

export const metadata: Metadata = { title: 'Terms of Service — Replova' }

const sections: LegalSection[] = [
  {
    heading: 'The thing you signed up for',
    content: (
      <p>
        By accessing or using Replova (&ldquo;the Service&rdquo;), you agree to be bound by these Terms and our{' '}
        <a href="/privacy" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>Privacy Policy</a>.
        Replova is a restaurant reputation management platform. Features include AI-generated review reply drafts,
        sentiment analysis, competitor rating tracking, review request campaigns, weekly digest emails, and reputation scoring.
      </p>
    ),
  },
  {
    heading: 'Your account',
    content: (
      <p>
        You are responsible for keeping your sign-in email secure. We don&apos;t use passwords. If your inbox is
        compromised, that is sufficient access for someone to sign in as you. You are also responsible for reviewing
        all AI-generated content before posting it publicly.
      </p>
    ),
  },
  {
    heading: 'Connected services',
    content: (
      <p>
        When you connect Google Business, we receive read access to reviews on the connected listing(s) and write
        access to post replies. We use this access only for the features advertised in the product. You can
        disconnect Google at any time from the Settings page. Use of Google data is subject to Google&apos;s own
        Terms of Service and API usage policies.
      </p>
    ),
  },
  {
    heading: 'Replies we post',
    content: (
      <p>
        AI drafts are suggestions, not statements made by Replova. Replies posted to Google appear under your
        account; you are responsible for their content. Auto-reply (if enabled) is bounded by the conditions you
        set in Settings.
      </p>
    ),
  },
  {
    heading: 'Plans, billing, refunds',
    content: (
      <>
        <p style={{ marginBottom: 12 }}>
          Replova offers three monthly plans, each including a <strong style={{ color: 'var(--t1)' }}>30-day free trial</strong>:
        </p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 0, marginBottom: 12 }}>
          {[
            { n: 'Starter', d: '$39/month · 1 location · 3 competitor slots' },
            { n: 'Growth',  d: '$99/month · up to 5 locations · 5 competitor slots · sentiment & scores' },
            { n: 'Agency',  d: '$199/month · up to 15 locations · 10 competitor slots · custom persona & white-label reports' },
          ].map(p => (
            <li key={p.n} style={{ display: 'flex', gap: 8 }}>
              <strong style={{ color: 'var(--t1)', minWidth: 60 }}>{p.n}</strong>
              <span>{p.d}</span>
            </li>
          ))}
        </ul>
        <p>
          Plans renew monthly. After trial, your card is charged at the start of each month. You may cancel or
          change your plan at any time via the Billing page. For full details on refunds, see our{' '}
          <a href="/refunds" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>Refund Policy</a>.
        </p>
      </>
    ),
  },
  {
    heading: 'Acceptable use',
    content: (
      <>
        <p style={{ marginBottom: 10 }}>You agree not to:</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 0, marginBottom: 10 }}>
          {[
            'Use the Service for any unlawful purpose or in violation of any applicable regulation',
            'Post or distribute harmful, defamatory, or misleading content using AI-generated drafts',
            'Attempt to reverse-engineer, scrape, or otherwise extract data from the Service',
            'Circumvent any usage limits or plan restrictions',
            "Violate Google's Terms of Service or Policies while using the Google integration",
          ].map(item => (
            <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--t4)', flexShrink: 0, marginTop: 9 }} />
              {item}
            </li>
          ))}
        </ul>
        <p>We reserve the right to suspend or terminate accounts that violate these terms without prior notice.</p>
      </>
    ),
  },
  {
    heading: 'Data and privacy',
    content: (
      <p>
        We store only the data necessary to provide the Service: your email, restaurant details, review content
        fetched from Google, and generated reply drafts. We do not sell your data. See our{' '}
        <a href="/privacy" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>Privacy Policy</a> for full details.
      </p>
    ),
  },
  {
    heading: 'Account termination',
    content: (
      <p>
        You may delete your account at any time from Settings → Danger zone. Upon deletion, all associated data —
        including restaurants, reviews, and reply drafts — is permanently removed. This action cannot be undone.
        We may also terminate accounts for violation of these Terms.
      </p>
    ),
  },
  {
    heading: 'The boring legal bits',
    content: (
      <p>
        Service is provided &ldquo;as is.&rdquo; To the maximum extent permitted by applicable law, we disclaim all
        warranties, express or implied. We shall not be liable for any indirect, incidental, special, or
        consequential damages, including lost profits or data. Our total liability for any claim shall not exceed
        the amount you paid us in the three months prior to the claim. Either party can terminate with 30 days
        notice. Disputes are resolved in New York.
      </p>
    ),
  },
  {
    heading: 'Changes to terms',
    content: (
      <p>
        We may update these Terms from time to time. We will notify you of material changes via email. Continued
        use of the Service after changes constitutes acceptance of the updated Terms.
      </p>
    ),
  },
]

export default function TermsPage() {
  return (
    <LegalLayout
      page="terms"
      title="Terms of Service"
      kicker="Effective April 25, 2025"
      sections={sections}
    />
  )
}
