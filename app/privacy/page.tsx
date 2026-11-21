import type { Metadata } from 'next'
import LegalLayout from '@/components/LegalLayout'
import type { LegalSection } from '@/components/LegalLayout'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Privacy Policy',
  description: 'Learn how Replova collects, uses, protects, and retains account, review, and application data.',
  path: '/privacy',
})

const sections: LegalSection[] = [
  {
    heading: 'What we collect',
    content: (
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0 }}>
        {[
          'Tap feedback includes the rating, optional comment, time, location, and placard. The form does not ask for contact details or use marketing analytics.',
          'Playbooks store issue evidence, owner notes, service limits, written quotes and provider confirmations.',
          'Your email address (used to sign in and send weekly digests)',
          'Your business name and Google Place ID (to fetch reviews)',
          'Optional profile information: display name, phone number, profile picture',
          'Google reviews fetched via the Google Places API (publicly available data)',
          'Payment information (processed by Stripe, we never see your card details)',
          'Demo scheduling details: name, email address, business name, and requested meeting time',
          'Career application details and an optional résumé when you apply for an internship',
        ].map(item => (
          <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--t4)', flexShrink: 0, marginTop: 9 }} />
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    heading: 'How we use it',
    content: (
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 0 }}>
        {[
          'To generate AI reply drafts for your Google reviews',
          'To send you weekly email digests with those drafts',
          'To manage your account and subscription',
          'To schedule requested demos and deliver calendar invitations',
          'To evaluate career applications and contact applicants',
          'When analysis is enabled for a location, written Tap comments are sent to OpenAI to identify sentiment, themes, and urgency. Replova requests that OpenAI does not store the response.',
          'Authorized provider requests include the service scope, service area, dates and relevant quote or appointment terms.',
          'We do not sell your data to third parties',
        ].map(item => (
          <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--t4)', flexShrink: 0, marginTop: 9 }} />
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    heading: 'Third-party services',
    content: (
      <>
        <p style={{ marginBottom: 14 }}>We use the following services to operate Replova:</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { name: 'Supabase',           role: 'Database and authentication' },
            { name: 'Stripe',             role: 'Payment processing'          },
            { name: 'OpenAI', role: 'Reply drafting, Google review analysis, and Tap comment analysis' },
            { name: 'Google Places API',  role: 'Fetching public reviews'     },
            { name: 'Resend',             role: 'Email delivery'              },
            { name: 'Zoho Mail',          role: 'Demo calendar invitations'   },
            { name: 'Vercel',             role: 'Hosting and infrastructure'  },
          ].map(({ name, role }) => (
            <div key={name} style={{ padding: '10px 14px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{name}</p>
              <p style={{ fontSize: 12, color: 'var(--t3)' }}>{role}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    heading: 'AI drafts',
    content: (
      <p>Reply drafts and review analysis are generated through OpenAI&apos;s API. Review text is sent only to provide these features, and Replova requests non-persistent API responses.</p>
    ),
  },
  {
    heading: 'Career applicants',
    content: (
      <p>
        Career applications and optional résumés are stored in Replova&apos;s private recruiting system. Authorized reviewers may record application
        status and internal evaluation notes. Resend may also deliver a notification copy to our recruiting inbox. We use this information only to
        evaluate your application, communicate about a role, and maintain appropriate recruiting records. Please do not include sensitive personal
        information that is not needed for the application. You may request deletion by emailing{' '}
        <a href="mailto:careers@replova.app" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>careers@replova.app</a>.
      </p>
    ),
  },
  {
    heading: 'Data retention',
    content: (
      <p>
        We retain account data while your account is active and as needed for legitimate operational, security, tax, or legal purposes. Career applications
        may be retained for up to 12 months unless a shorter period is required by law or you request deletion. You may request account deletion by emailing{' '}
        <a href="mailto:support@replova.app" style={{ color: 'var(--t1)', textDecoration: 'underline' }}>support@replova.app</a>{' '}
        or using the Delete account option in the Danger zone section of Settings. Deleted data may remain temporarily in encrypted backups until those backups age out.
      </p>
    ),
  },
  {
    heading: 'Security',
    content: (
      <p>All data is encrypted in transit (TLS). Passwords are not stored. We use passwordless magic link authentication via Supabase.</p>
    ),
  },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      page="privacy"
      title="Privacy Policy"
      kicker="Last updated November 17, 2026"
      sections={sections}
    />
  )
}
