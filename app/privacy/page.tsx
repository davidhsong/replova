import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy — Replova' }

export default function PrivacyPage() {
  const year = new Date().getFullYear()
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <header className="border-b border-zinc-200 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="text-base font-semibold tracking-tight text-zinc-900">Replova</a>
          <a href="/signin" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">Sign in</a>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto px-6 py-14 w-full fade-up">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Privacy Policy</h1>
          <p className="text-zinc-400 text-sm">Last updated: January 1, {year}</p>
        </div>

        <div className="space-y-8 text-sm text-zinc-600 leading-relaxed">
          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">1. What We Collect</h2>
            <ul className="space-y-2 pl-4">
              {[
                'Your email address (used to sign in and send weekly digests)',
                'Your restaurant name and Google Place ID (to fetch reviews)',
                'Optional profile information: display name, phone number, profile picture',
                'Google reviews fetched via the Google Places API (publicly available data)',
                'Payment information (processed by Stripe — we never see your card details)',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-400 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">2. How We Use It</h2>
            <ul className="space-y-2 pl-4">
              {[
                'To generate AI reply drafts for your Google reviews',
                'To send you weekly email digests with those drafts',
                'To manage your account and subscription',
                'We do not sell your data to third parties',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="w-1 h-1 rounded-full bg-zinc-400 mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">3. Third-Party Services</h2>
            <p className="mb-3">We use the following services to operate Replova:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Supabase', role: 'Database and authentication' },
                { name: 'Stripe', role: 'Payment processing' },
                { name: 'Anthropic (Claude)', role: 'AI reply generation' },
                { name: 'Google Places API', role: 'Fetching public reviews' },
                { name: 'Resend', role: 'Email delivery' },
                { name: 'Vercel', role: 'Hosting and infrastructure' },
              ].map(({ name, role }) => (
                <div key={name} className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                  <p className="text-xs font-semibold text-zinc-900">{name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{role}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">4. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. You may request deletion by emailing{' '}
              <a href="mailto:support@replova.app" className="text-zinc-900 underline underline-offset-2 hover:text-blue-600 transition-colors">
                support@replova.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">5. Security</h2>
            <p>
              All data is encrypted in transit (TLS). Passwords are not stored — we use passwordless magic link authentication via Supabase.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">6. Contact</h2>
            <p>
              Privacy questions? Email{' '}
              <a href="mailto:support@replova.app" className="text-zinc-900 underline underline-offset-2 hover:text-blue-600 transition-colors">
                support@replova.app
              </a>.
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900">Replova</span>
          <div className="flex items-center gap-5">
            <a href="/terms" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Terms</a>
            <a href="mailto:support@replova.app" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Support</a>
            <span className="text-xs text-zinc-400">© {year} Replova</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
