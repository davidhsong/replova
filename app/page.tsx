import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Replova — AI replies to your Google reviews" },
  description:
    "Replova monitors your Google Business reviews and generates 3 AI-written replies for each one. Pick a tone, copy it, done. Free 30-day trial.",
};

function ProductMockup() {
  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-left w-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-100 tracking-tight">Replova</span>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-xs text-zinc-500">Review Center</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"></span>
          <span className="text-xs text-zinc-500">Monitoring</span>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-900/40 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
        <span className="text-xs text-amber-300 font-medium">3 reviews need your reply</span>
        <span className="ml-auto text-xs text-amber-500/70">2 urgent</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Needs reply</p>
          <p className="text-sm font-semibold text-zinc-100">3</p>
        </div>
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Avg rating</p>
          <p className="text-sm font-semibold text-amber-400">★ 3.8</p>
        </div>
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Response rate</p>
          <p className="text-sm font-semibold text-zinc-100">94%</p>
        </div>
      </div>

      <div className="flex border-b border-zinc-800 px-4">
        <span className="py-2 text-xs font-medium text-zinc-100 border-b-2 border-zinc-100 -mb-px mr-4">Needs Reply</span>
        <span className="py-2 text-xs text-zinc-600 mr-4">Completed</span>
        <span className="py-2 text-xs text-zinc-600">All</span>
      </div>

      {/* Urgent review — expanded */}
      <div className="border-b border-zinc-800 bg-zinc-900/40">
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="shrink-0 w-14">
            <span className="text-amber-400 text-xs">★☆☆☆☆</span>
            <p className="text-zinc-600 text-xs">1/5</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-xs font-medium text-zinc-100">James K.</p>
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-red-950 text-red-400 border border-red-900/60 font-medium">Urgent</span>
            </div>
            <p className="text-xs text-zinc-500 truncate">Waited 45 min despite a reservation. Food arrived cold...</p>
          </div>
          <span className="text-xs text-zinc-600 shrink-0">2h ago</span>
        </div>

        <div className="px-4 pb-3 space-y-2 border-t border-zinc-800 pt-3">
          <div className="flex gap-1 mb-2">
            <span className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-100 rounded font-medium">Professional</span>
            <span className="px-2 py-0.5 text-xs text-zinc-500 rounded">Warm</span>
            <span className="px-2 py-0.5 text-xs text-zinc-500 rounded">Brief</span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 leading-relaxed mb-2">
              Hi James, I sincerely apologize — a 45-minute wait with a reservation and cold food is completely unacceptable. This isn&apos;t our standard and I&apos;d love to make it right. Please reach out directly.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700">Copy</span>
              <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">Reply on Google</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3 opacity-60">
        <div className="shrink-0 w-14">
          <span className="text-amber-400 text-xs">★★☆☆☆</span>
          <p className="text-zinc-600 text-xs">2/5</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-100">Maria S.</p>
          <p className="text-xs text-zinc-500 truncate">The pasta used to be amazing but something has changed...</p>
        </div>
        <span className="text-xs text-zinc-600 shrink-0">Yesterday</span>
      </div>

      <div className="px-4 py-3 flex items-center gap-3 opacity-40">
        <div className="shrink-0 w-14">
          <span className="text-amber-400 text-xs">★★★★★</span>
          <p className="text-zinc-600 text-xs">5/5</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-zinc-100">Sofia L.</p>
          <p className="text-xs text-zinc-500 truncate">Best anniversary dinner we&apos;ve ever had. Carlos was wonderful!</p>
        </div>
        <span className="text-xs text-zinc-600 shrink-0">Mar 18</span>
      </div>
    </div>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white text-zinc-900 font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-base font-semibold tracking-tight text-zinc-900">Replova</span>
          <div className="flex items-center gap-2">
            <a href="/signin" className="text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors px-3 py-1.5">
              Sign in
            </a>
            <a href="/onboard" className="btn-press rounded-full bg-zinc-900 text-white text-sm font-medium px-4 py-2 hover:bg-zinc-700 transition-colors">
              Start free trial
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 max-w-6xl mx-auto w-full px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-12 items-center">
          <div className="fade-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
              <span className="text-xs font-medium text-blue-700">AI replies for Google reviews</span>
            </div>

            <h1 className="text-4xl md:text-[3.25rem] font-bold leading-[1.1] tracking-tight text-zinc-900 mb-5">
              Every review.
              <br />
              <span className="text-blue-600">Replied to in seconds.</span>
            </h1>

            <p className="text-base md:text-lg text-zinc-500 leading-relaxed mb-8 max-w-md">
              Replova monitors your Google Business reviews and generates
              3 AI-written replies for each one — Professional, Warm, or Brief.
              Pick one. Paste it. Done in under 2 minutes.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <a
                href="/onboard"
                className="btn-press inline-flex items-center gap-2 rounded-full bg-zinc-900 text-white text-sm font-semibold px-6 py-3 hover:bg-zinc-700 transition-colors"
              >
                Start your free trial
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <span className="text-xs text-zinc-400">30 days free · No credit card</span>
            </div>
          </div>

          <div className="fade-up" style={{ animationDelay: "80ms" }}>
            <ProductMockup />
          </div>
        </div>
      </section>

      {/* Before / After — 1-star rescue */}
      <section className="border-t border-zinc-100 bg-zinc-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">1-star rescue</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">
              Turn a bad review into proof you care
            </h2>
            <p className="text-zinc-500 text-base mt-3 max-w-xl">
              Other customers read your responses. A thoughtful reply to a 1-star review
              builds more trust than any 5-star one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 items-start max-w-4xl">
            {/* The review */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold text-zinc-600 shrink-0">J</div>
                <div>
                  <p className="text-sm font-semibold text-zinc-900">James K.</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-500">★</span>
                    <span className="text-xs text-zinc-400">☆☆☆☆ · 2 hours ago</span>
                  </div>
                </div>
                <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">1 star</span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed">
                &ldquo;Waited 45 minutes even though we had a reservation. The food
                came out cold and no one came to check on us the whole meal.
                Very disappointing — won&apos;t be coming back.&rdquo;
              </p>
              <p className="mt-4 text-xs text-zinc-400 italic">Without Replova: this sits unanswered for days.</p>
            </div>

            {/* The AI reply */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-blue-800">Replova — AI reply (Professional tone)</p>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">
                &ldquo;Hi James, thank you for sharing your experience. I sincerely
                apologize — a 45-minute wait despite a reservation, cold food,
                and no table attention is completely unacceptable. This isn&apos;t
                our standard and I&apos;d love the opportunity to make it right.
                Please reach out to us directly at hello@restaurant.com.&rdquo;
              </p>
              <p className="mt-4 text-xs text-blue-700 font-medium">→ Ready in seconds. Just copy and paste.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why responding matters */}
      <section className="py-20 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Why it matters</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Your reviews are your reputation</h2>
            <p className="text-zinc-500 text-base mt-3 max-w-xl">
              Most businesses lose customers not because of a bad review — but because they never responded to it.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                ),
                title: "Builds trust",
                body: "Customers trust businesses that respond to reviews 2× more than those that don't. Every reply is a signal that you care.",
              },
              {
                icon: (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                ),
                title: "Improves rankings",
                body: "Google favors businesses that actively engage with their reviews. Responding consistently boosts your local search visibility.",
              },
              {
                icon: (
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: "Increases conversions",
                body: "A thoughtful response to a negative review can turn a lost customer into a loyal one — and show prospective customers you take quality seriously.",
              },
            ].map(({ icon, title, body }, i) => (
              <div key={title} className="fade-up flex flex-col gap-4" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-10 h-10 rounded-xl bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                  {icon}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 mb-1.5">{title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">How it works</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">From review to reply in under 2 minutes</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Connect your Google Business",
                body: "Enter your business name and we find your Google Business profile automatically. Takes under 5 minutes.",
              },
              {
                step: "02",
                title: "Get 3 AI reply options instantly",
                body: "Every new review gets three ready-to-use responses — Professional, Warm, and Brief — generated by Claude AI.",
              },
              {
                step: "03",
                title: "Post directly to Google",
                body: 'Pick the tone that fits, click "Reply on Google", and your response is live. No copy-pasting required.',
              },
            ].map(({ step, title, body }, i) => (
              <div key={step} className="fade-up flex flex-col gap-4" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
                  <span className="text-xs font-bold text-white font-mono">{step}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-zinc-900 mb-1.5">{title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t border-zinc-100">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Features</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Your review action center</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:row-span-2 rounded-2xl bg-zinc-950 p-8 flex flex-col justify-between min-h-64">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">3 suggested replies, one click</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Every review gets three AI-written responses: Professional for formal
                  replies, Warm for building loyalty, Brief when you just need it done.
                  Pick the one that fits your voice.
                </p>
              </div>
              <div className="mt-8 space-y-2">
                {[
                  { color: "bg-indigo-500", label: "Professional" },
                  { color: "bg-emerald-500", label: "Warm" },
                  { color: "bg-amber-500", label: "Brief" },
                ].map(({ color, label }) => (
                  <div
                    key={label}
                    className={`h-1.5 rounded-full ${color} opacity-70`}
                    style={{ width: label === "Professional" ? "85%" : label === "Warm" ? "65%" : "45%" }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">Urgent review alerts</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                1 and 2-star reviews surface at the top, flagged as urgent. Never leave a bad review sitting unanswered.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">Post directly to Google</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Connect your Google Business and reply with one click — no copy-pasting, no switching tabs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — 3 tiers */}
      <section className="py-20 px-6 border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Simple, honest pricing</h2>
            <p className="text-zinc-500 text-base mt-3">Start free for 30 days. No credit card required.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Solo */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-sm font-semibold text-zinc-900 mb-1">Solo</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-zinc-900">$49</span>
                  <span className="text-zinc-500 text-sm">/ month</span>
                </div>
                <p className="text-xs text-zinc-400">For single-location businesses</p>
              </div>
              <div className="space-y-2.5 mb-8 flex-1">
                {[
                  "1 location",
                  "Unlimited reviews",
                  "AI reply drafts (3 per review)",
                  "Weekly email digest",
                  "Review dashboard",
                  "Urgent alerts",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-600">{item}</span>
                  </div>
                ))}
              </div>
              <a
                href="/onboard"
                className="btn-press block w-full text-center rounded-full border border-zinc-900 text-zinc-900 text-sm font-semibold px-6 py-2.5 hover:bg-zinc-50 transition-colors"
              >
                Start free trial
              </a>
            </div>

            {/* Growth — featured */}
            <div className="rounded-2xl border-2 border-zinc-900 bg-zinc-950 p-7 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most popular</span>
              </div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-zinc-100 mb-1">Growth</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-zinc-100">$99</span>
                  <span className="text-zinc-400 text-sm">/ month</span>
                </div>
                <p className="text-xs text-zinc-500">For serious operators</p>
              </div>
              <div className="space-y-2.5 mb-8 flex-1">
                {[
                  "Everything in Solo",
                  "Post replies directly to Google",
                  "Auto-detect already-replied reviews",
                  "Priority email support",
                  "Response rate tracking",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
              <a
                href="/onboard"
                className="btn-press block w-full text-center rounded-full bg-white text-zinc-900 text-sm font-semibold px-6 py-2.5 hover:bg-zinc-100 transition-colors"
              >
                Start free trial
              </a>
            </div>

            {/* Agency */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-7 flex flex-col">
              <div className="mb-6">
                <p className="text-sm font-semibold text-zinc-900 mb-1">Agency</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-zinc-900">$199</span>
                  <span className="text-zinc-500 text-sm">/ month</span>
                </div>
                <p className="text-xs text-zinc-400">For multi-location groups</p>
              </div>
              <div className="space-y-2.5 mb-8 flex-1">
                {[
                  "Up to 5 locations",
                  "Everything in Growth",
                  "Multi-location dashboard",
                  "Custom reply tone training",
                  "Dedicated support",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-600">{item}</span>
                  </div>
                ))}
              </div>
              <a
                href="mailto:support@replova.app"
                className="btn-press block w-full text-center rounded-full border border-zinc-900 text-zinc-900 text-sm font-semibold px-6 py-2.5 hover:bg-zinc-50 transition-colors"
              >
                Contact us
              </a>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-400 mt-8">
            All plans include a 30-day free trial · Cancel anytime · No setup fees
          </p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-6 border-t border-zinc-200 bg-zinc-950">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 mb-3">
            Stop letting reviews go unanswered
          </h2>
          <p className="text-zinc-400 text-base mb-8">
            Free for 30 days. No credit card required. Up and running in under 5 minutes.
          </p>
          <a
            href="/onboard"
            className="btn-press inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 text-sm font-semibold px-8 py-3 hover:bg-zinc-100 transition-colors"
          >
            Start your free trial
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm font-semibold text-zinc-100">Replova</span>
          <div className="flex items-center gap-5">
            <a href="/terms" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Terms</a>
            <a href="/privacy" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Privacy</a>
            <a href="mailto:support@replova.app" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Support</a>
            <span className="text-xs text-zinc-600">© {year} Replova</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
