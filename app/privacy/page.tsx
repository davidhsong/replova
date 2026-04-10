import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold tracking-tight text-zinc-900">Replova</a>
          <a href="/signin" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Sign in</a>
        </div>
      </header>
      <div className="flex-1 max-w-2xl mx-auto px-6 py-16 w-full">
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Privacy Policy</h1>
        <p className="text-zinc-400 text-sm mb-10">Last updated: January 1, {year}</p>

        <div className="space-y-8 text-sm text-zinc-700 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">1. What We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your email address (used to sign in and send weekly digests)</li>
              <li>Your restaurant name and Google Place ID (to fetch reviews)</li>
              <li>Optional profile information: display name, phone number, profile picture</li>
              <li>Google reviews fetched via the Google Places API (publicly available data)</li>
              <li>Payment information (processed by Stripe — we never see your card details)</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">2. How We Use It</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To generate AI reply drafts for your Google reviews</li>
              <li>To send you weekly email digests with those drafts</li>
              <li>To manage your account and subscription</li>
              <li>We do not sell your data to third parties</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">3. Third-Party Services</h2>
            <p>We use the following services to operate Replova:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Supabase</strong> — database and authentication</li>
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Anthropic (Claude)</strong> — AI reply generation</li>
              <li><strong>Google Places API</strong> — fetching public reviews</li>
              <li><strong>Resend</strong> — email delivery</li>
              <li><strong>Vercel</strong> — hosting and infrastructure</li>
            </ul>
          </section>
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">4. Data Retention</h2>
            <p>We retain your data for as long as your account is active. You may request deletion by emailing <a href="mailto:support@replova.app" className="text-zinc-900 underline">support@replova.app</a>.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">5. Security</h2>
            <p>All data is encrypted in transit (TLS). Passwords are not stored — we use passwordless magic link authentication via Supabase.</p>
          </section>
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">6. Contact</h2>
            <p>Privacy questions? Email <a href="mailto:support@replova.app" className="text-zinc-900 underline">support@replova.app</a>.</p>
          </section>
        </div>
      </div>
      <footer className="border-t border-zinc-200 py-5 px-6">
        <p className="text-center text-sm text-zinc-400">© {year} Replova. All rights reserved.</p>
      </footer>
    </div>
  )
}
