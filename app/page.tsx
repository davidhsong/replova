import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { absolute: 'Replova — AI Review Replies for Restaurants' },
}

export default function Home() {
  const year = new Date().getFullYear()

  return (
    <div className="flex flex-col flex-1 bg-white text-zinc-900 font-sans">

      {/* Nav */}
      <header className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">
            Replova
          </span>
          <div className="flex items-center gap-3">
            <a
              href="/signin"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Sign in
            </a>
            <a
              href="/onboard"
              className="rounded-full bg-zinc-900 text-white text-sm font-medium px-5 py-2 hover:bg-zinc-700 transition-colors"
            >
              Start free trial
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight text-zinc-900">
            Your Google reviews get replied to. Every week. Without lifting a finger.
          </h1>
          <p className="mt-5 text-lg text-zinc-500 max-w-xl mx-auto leading-relaxed">
            Replova connects to your Google listing and delivers AI-written reply
            drafts every Monday morning. Copy, paste, done — your reputation
            stays sharp in under two minutes.
          </p>
          <a
            href="/onboard"
            className="mt-8 inline-block rounded-full bg-zinc-900 text-white text-base font-medium px-8 py-3 hover:bg-zinc-700 transition-colors"
          >
            Start your free trial
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-zinc-200">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-900 mb-12">
            How it works
          </h2>
          <div className="flex flex-col md:flex-row gap-10 md:gap-6">

            <div className="flex-1 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-900">
                1
              </div>
              <h3 className="text-base font-semibold text-zinc-900">
                Connect your Google listing
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Takes about 5 minutes. No technical setup required.
              </p>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-900">
                2
              </div>
              <h3 className="text-base font-semibold text-zinc-900">
                Get AI reply drafts every Monday morning
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                We check for new reviews weekly and write ready-to-use replies.
              </p>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-900">
                3
              </div>
              <h3 className="text-base font-semibold text-zinc-900">
                Copy, paste into Google Maps. Done in 2 minutes.
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                No logins to manage. No dashboard to check. Just open your email.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 px-6 border-t border-zinc-200">
        <div className="max-w-sm mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-zinc-900 mb-10">
            Simple pricing
          </h2>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
            <div className="text-center">
              <span className="text-5xl font-bold text-zinc-900">$99</span>
              <span className="text-base text-zinc-500"> / month</span>
              <p className="mt-2 text-sm text-zinc-500">
                30-day free trial. Cancel anytime.
              </p>
            </div>

            <hr className="my-6 border-zinc-200" />

            <ul className="flex flex-col gap-3">
              <li className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="font-bold text-zinc-900 mt-px">✓</span>
                AI-generated replies for every new review
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="font-bold text-zinc-900 mt-px">✓</span>
                3 tone options: Professional, Warm, and Brief
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="font-bold text-zinc-900 mt-px">✓</span>
                Weekly Monday morning email delivery
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-700">
                <span className="font-bold text-zinc-900 mt-px">✓</span>
                Cancel anytime, no contracts
              </li>
            </ul>

            <a
              href="/onboard"
              className="mt-8 block w-full text-center rounded-full bg-zinc-900 text-white text-sm font-medium px-6 py-3 hover:bg-zinc-700 transition-colors"
            >
              Start free trial
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-zinc-50 border-y border-zinc-200 py-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">
            Start your free 30-day trial
          </h2>
          <p className="mt-3 text-base text-zinc-500">
            No credit card required to get started.
          </p>
          <a
            href="/onboard"
            className="mt-8 inline-block rounded-full bg-zinc-900 text-white text-base font-medium px-8 py-3 hover:bg-zinc-700 transition-colors"
          >
            Start your free 30-day trial
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-900">Replova</span>
          <span className="text-sm text-zinc-500">
            © {year} Replova. All rights reserved.
          </span>
        </div>
      </footer>

    </div>
  )
}
