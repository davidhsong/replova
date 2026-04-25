import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Refund Policy — Replova' }

export default function RefundPage() {
  const year = new Date().getFullYear()
  const updated = 'April 25, 2025'

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
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Refund Policy</h1>
          <p className="text-zinc-400 text-sm">Last updated: {updated}</p>
        </div>

        <div className="space-y-8 text-sm text-zinc-600 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Free Trial</h2>
            <p>
              All Replova plans include a <strong className="text-zinc-800">30-day free trial</strong>. You will not be charged
              anything during the trial period. You can cancel at any time before the trial ends and you will
              owe nothing. Your first charge occurs only after the 30-day trial expires.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Cancellations</h2>
            <p>
              You may cancel your subscription at any time through the{' '}
              <strong className="text-zinc-800">Billing page</strong> in your dashboard (Settings → Billing →
              Manage subscription). Cancellation takes effect at the end of your current billing period —
              you retain full access to all features until then. We do not charge cancellation fees.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Refunds on Paid Subscriptions</h2>
            <p className="mb-3">
              Because Replova is a software-as-a-service product that begins delivering value immediately
              upon activation, <strong className="text-zinc-800">we do not issue refunds for partial billing
              periods</strong> or for months already charged.
            </p>
            <p>
              This means: if you are billed on the 1st of the month and cancel on the 15th, your subscription
              remains active through the end of that month and no refund is issued for the unused days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Exceptions</h2>
            <p className="mb-3">We will consider refunds on a case-by-case basis in the following situations:</p>
            <ul className="list-disc list-inside space-y-1.5 text-zinc-600">
              <li>You were charged in error (e.g., a duplicate charge or billing system error)</li>
              <li>
                A verified service outage or critical bug prevented you from using Replova for a
                substantial portion of a billing period and we were unable to resolve it in a reasonable time
              </li>
              <li>You contacted us within 7 days of a charge and had not meaningfully used the service since the last billing cycle</li>
            </ul>
            <p className="mt-3">
              To request an exception, email{' '}
              <a href="mailto:support@replova.app" className="text-zinc-900 underline underline-offset-2 hover:text-blue-600 transition-colors">
                support@replova.app
              </a>{' '}
              within <strong className="text-zinc-800">14 days</strong> of the charge in question. Include your account
              email and a brief description of the issue. We respond to all refund requests within 3 business days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Plan Downgrades</h2>
            <p>
              You can downgrade your plan at any time via the billing portal. The lower-tier pricing takes
              effect at the start of your next billing cycle. We do not issue credits or refunds for the
              difference in price mid-cycle.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Chargebacks</h2>
            <p>
              If you believe a charge was made in error, please contact us at{' '}
              <a href="mailto:support@replova.app" className="text-zinc-900 underline underline-offset-2 hover:text-blue-600 transition-colors">
                support@replova.app
              </a>{' '}
              before initiating a chargeback with your bank. We will work quickly to resolve the issue directly.
              Initiating a chargeback without first contacting us may result in suspension of your account
              while the dispute is under review.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Contact</h2>
            <p>
              Questions about this policy? Reach us at{' '}
              <a href="mailto:support@replova.app" className="text-zinc-900 underline underline-offset-2 hover:text-blue-600 transition-colors">
                support@replova.app
              </a>. We aim to respond within one business day.
            </p>
          </section>

        </div>
      </div>

      <footer className="border-t border-zinc-200">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-900">Replova</span>
          <div className="flex items-center gap-5">
            <a href="/terms" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Terms</a>
            <a href="/privacy" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Privacy</a>
            <a href="mailto:support@replova.app" className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors">Support</a>
            <span className="text-xs text-zinc-400">© {year} Replova</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
