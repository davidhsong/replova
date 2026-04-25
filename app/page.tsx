import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Replova — Reply to every Google review in 60 seconds" },
  description:
    "Replova monitors your Google Business reviews and drafts three ready-to-post replies for every new one. Professional, Warm, or Brief. Post directly to Google in under 60 seconds.",
};

function ProductMockup() {
  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden text-left w-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ width: 20, height: 20, background: 'oklch(0.62 0.19 258)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <span className="text-xs font-semibold text-zinc-100 tracking-tight">Replova</span>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-xs text-zinc-500">Review Center</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot"></span>
          <span className="text-xs text-zinc-500">Live</span>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-red-950/40 border-b border-red-900/30 flex items-center gap-2">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span className="text-xs text-red-400 font-medium">2 urgent reviews — no reply yet</span>
        <span className="ml-auto text-xs text-red-500/60">just now</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-zinc-800 border-b border-zinc-800">
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Awaiting reply</p>
          <p className="text-sm font-bold text-red-400">3</p>
        </div>
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Google rating</p>
          <p className="text-sm font-bold text-amber-400">4.1 ★</p>
        </div>
        <div className="bg-zinc-950 px-4 py-2.5">
          <p className="text-xs text-zinc-600">Response rate</p>
          <p className="text-sm font-bold text-zinc-100">94%</p>
        </div>
      </div>

      <div className="flex border-b border-zinc-800 px-4">
        <span className="py-2 text-xs font-semibold text-zinc-100 border-b-2 border-zinc-100 -mb-px mr-4">Needs Reply</span>
        <span className="py-2 text-xs text-zinc-600 mr-4">Completed</span>
        <span className="py-2 text-xs text-zinc-600">All</span>
      </div>

      {/* Urgent review — expanded */}
      <div className="border-b border-zinc-800/60" style={{ borderLeft: '3px solid #ef4444' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="shrink-0 w-14">
            <div className="flex gap-0.5">
              {[1,0,0,0,0].map((f,i) => (
                <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill={f ? '#f59e0b' : 'none'} stroke={f ? '#f59e0b' : '#3f3f46'} strokeWidth="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              ))}
            </div>
            <p className="text-zinc-600 text-xs mt-0.5">1/5</p>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-xs font-semibold text-zinc-100">James K.</p>
              <span className="text-xs px-1.5 py-px rounded bg-red-950/80 text-red-400 border border-red-900/50 font-semibold">Urgent</span>
            </div>
            <p className="text-xs text-zinc-500 truncate">Waited 45 min despite a reservation. Food was cold...</p>
          </div>
          <span className="text-xs text-zinc-600 shrink-0">2h ago</span>
        </div>

        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-zinc-800/60">
          <div className="flex gap-1">
            <span className="px-2.5 py-1 text-xs bg-zinc-700 text-zinc-100 rounded-md font-semibold">Professional</span>
            <span className="px-2.5 py-1 text-xs text-zinc-500 rounded-md">Warm</span>
            <span className="px-2.5 py-1 text-xs text-zinc-500 rounded-md">Brief</span>
          </div>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3">
            <p className="text-xs text-zinc-300 leading-relaxed mb-3">
              Hi James — a 45-minute wait with a reservation, and food that arrived cold, is completely unacceptable. I sincerely apologize. Please reach out directly so I can make this right.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <span className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-700/60">Copy</span>
              <span className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg font-medium">Reply on Google</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-zinc-800/40 flex items-center gap-3 opacity-50" style={{ borderLeft: '3px solid #f59e0b' }}>
        <div className="shrink-0 w-14">
          <div className="flex gap-0.5">
            {[1,1,0,0,0].map((f,i) => (
              <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill={f ? '#f59e0b' : 'none'} stroke={f ? '#f59e0b' : '#3f3f46'} strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-zinc-100">Maria S.</p>
          <p className="text-xs text-zinc-500 truncate">The pasta used to be amazing but something has changed...</p>
        </div>
        <span className="text-xs text-zinc-600">Yesterday</span>
      </div>
    </div>
  );
}

export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col min-h-[100dvh] font-sans">

      {/* ── Nav ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{ width: 26, height: 26, background: 'oklch(0.62 0.19 258)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <span className="text-sm font-bold tracking-tight text-zinc-100">Replova</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/signin" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-1.5">
              Sign in
            </a>
            <a href="/onboard" className="btn-press rounded-full bg-white text-zinc-900 text-sm font-semibold px-4 py-2 hover:bg-zinc-100 transition-colors">
              Start free trial
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="bg-zinc-950 border-b border-zinc-800/60" style={{
        backgroundImage: 'radial-gradient(circle at 70% 50%, rgba(59,130,246,0.06) 0%, transparent 60%)',
      }}>
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-[1fr_1.05fr] gap-14 items-center">
            <div className="fade-up">
              <div className="inline-flex items-center gap-2 mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot shrink-0" />
                <span className="text-xs font-medium text-zinc-400 tracking-wide">For Google Business owners</span>
              </div>

              <h1 className="text-5xl md:text-[3.6rem] font-extrabold leading-[1.08] tracking-tight text-white mb-6">
                Every unanswered review<br />
                <span style={{ color: 'oklch(0.70 0.17 258)' }}>loses you a customer.</span>
              </h1>

              <p className="text-zinc-400 text-lg leading-relaxed mb-10 max-w-md">
                Replova monitors your Google Business and drafts three ready-to-post replies for every new review — Professional, Warm, or Brief. Post directly to Google in 60 seconds.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <a
                  href="/onboard"
                  className="btn-press inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 text-sm font-bold px-7 py-3.5 hover:bg-zinc-100 transition-colors"
                >
                  Start your free trial
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <span className="text-xs text-zinc-500">30 days free · No credit card</span>
              </div>
            </div>

            <div className="fade-up" style={{ animationDelay: '100ms' }}>
              <ProductMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat bar ─────────────────────────────────────────── */}
      <section className="bg-white border-b border-zinc-100">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 md:divide-x divide-zinc-100">
            {[
              {
                number: '89%',
                copy: 'of customers read owner replies before choosing a restaurant',
                source: 'BrightLocal, 2024',
              },
              {
                number: '2×',
                copy: 'more trust for businesses that respond to every review',
                source: 'Harvard Business Review',
              },
              {
                number: '60s',
                copy: 'average time to post a reply with Replova vs. 20+ minutes manually',
                source: 'Replova internal data',
              },
            ].map(({ number, copy, source }) => (
              <div key={number} className="md:px-10 first:pl-0 last:pr-0 fade-up">
                <div className="text-4xl font-extrabold tracking-tight text-zinc-900 mb-2" style={{ fontFeatureSettings: '"tnum"' }}>
                  {number}
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed mb-1">{copy}</p>
                <p className="text-xs text-zinc-400">{source}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The truth ────────────────────────────────────────── */}
      <section className="bg-white py-24 px-6 border-b border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 items-start">

            {/* The problem */}
            <div className="rounded-2xl border border-zinc-200 p-7">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-5">Without Replova</p>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600 shrink-0">J</div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">James K.</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-amber-500 text-xs">★</span>
                    <span className="text-xs text-zinc-400">☆☆☆☆ · 4 days ago</span>
                  </div>
                </div>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100">1 star</span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed mb-5">
                &ldquo;Waited 45 minutes even though we had a reservation. Food arrived cold and no one came to check on our table. Very disappointing — won&apos;t be back.&rdquo;
              </p>
              <div className="pt-4 border-t border-zinc-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-xs text-zinc-500">
                  Sitting unanswered for <strong className="text-zinc-700">4 days</strong>. New customers are reading this right now.
                </p>
              </div>
            </div>

            {/* The solution */}
            <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-7 flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-5">With Replova — 47 seconds later</p>
                <div className="flex gap-1.5 mb-4">
                  {['Professional', 'Warm', 'Brief'].map((t, i) => (
                    <span key={t} className={`px-2.5 py-1 text-xs rounded-md font-semibold ${i === 0 ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500'}`}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="bg-zinc-900/70 border border-zinc-700/50 rounded-xl p-4">
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                    &ldquo;Hi James — a 45-minute wait with a reservation, and food that came out cold, is completely unacceptable. I sincerely apologize. This isn&apos;t our standard and I&apos;d like to make it right. Please reach out directly.&rdquo;
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <span className="px-2.5 py-1 text-xs bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-700/60">Copy</span>
                    <span className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-lg font-medium">Reply on Google</span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <p className="text-xs text-zinc-400">
                  Posted. Future customers see you <strong className="text-zinc-200">actually care</strong>.
                </p>
              </div>
            </div>

          </div>

          {/* The argument */}
          <div className="mt-16 max-w-2xl">
            <p className="text-2xl md:text-3xl font-bold text-zinc-900 leading-snug tracking-tight mb-4">
              Other customers read your responses.<br />
              <span className="text-zinc-400">That&apos;s the part most owners miss.</span>
            </p>
            <p className="text-zinc-500 text-base leading-relaxed">
              A thoughtful reply to a 1-star review doesn&apos;t just patch things up with one upset customer —
              it shows the next 200 people who read it that you run a restaurant that gives a damn.
              Most owners know this. Most owners are also too busy to do anything about it.
              That&apos;s exactly what Replova is for.
            </p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="py-24 px-6 bg-zinc-50 border-b border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">Simpler than writing it yourself.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                n: '01',
                title: 'Connect your Google Business',
                body: 'Link your Google Business Profile in under 2 minutes. Replova starts monitoring your reviews immediately.',
              },
              {
                n: '02',
                title: 'Get three drafts, instantly',
                body: 'The moment a new review comes in, Replova generates a Professional, Warm, and Brief reply — each written for that specific review.',
              },
              {
                n: '03',
                title: 'Pick one, post to Google',
                body: 'Click the tone that fits, hit Reply on Google — and it&apos;s live. No switching tabs, no copy-pasting.',
              },
            ].map(({ n, title, body }, i) => (
              <div key={n} className="fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="text-5xl font-extrabold text-zinc-200 mb-4 leading-none font-mono tracking-tighter">{n}</div>
                <h3 className="text-base font-bold text-zinc-900 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed" dangerouslySetInnerHTML={{ __html: body }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white border-b border-zinc-100">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">What you get</p>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 tracking-tight">
              Built for the way restaurants actually work.
            </h2>
          </div>

          <div className="space-y-4">
            {/* Feature 1 — large dark card */}
            <div className="rounded-2xl bg-zinc-950 p-8 md:p-10">
              <div className="grid md:grid-cols-[1fr_1.2fr] gap-8 items-start">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mb-5">
                    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-3 tracking-tight">Three replies, every time.</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Claude AI reads the actual content of each review and writes three responses — not templates. A 1-star complaint about slow service gets a different reply than a 5-star shoutout to your chef.
                  </p>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Professional', desc: 'Formal, measured, builds brand trust', active: true },
                    { label: 'Warm', desc: 'Personal, empathetic, builds loyalty', active: false },
                    { label: 'Brief', desc: '2–3 sentences, done in 10 seconds', active: false },
                  ].map(({ label, desc, active }) => (
                    <div key={label} className={`rounded-xl px-4 py-3 border transition-colors ${active ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-900/50 border-zinc-800/50'}`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-xs font-bold ${active ? 'text-zinc-100' : 'text-zinc-500'}`}>{label}</span>
                        {active && <span className="text-xs text-blue-400 font-medium">Selected</span>}
                      </div>
                      <p className={`text-xs ${active ? 'text-zinc-400' : 'text-zinc-600'}`}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Features 2+3 — side-by-side cards */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-7">
                <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">1-star alerts — while you can still act</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Bad reviews get flagged as urgent the moment they come in. You&apos;ll never wake up to a 1-star that&apos;s been sitting unanswered for three days.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-7">
                <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">Competitor tracking — know where you stand</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Automatically discovers nearby restaurants and tracks their ratings daily. See exactly when a competitor&apos;s score drops — or climbs past yours.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-7">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">Weekly digest every Monday</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  A short email with your response rate, top keywords from reviews, and the replies that still need attention. Arrives before the week starts.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-7">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-zinc-900 mb-2">Auto-detects replied reviews</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  If you reply directly on Google, Replova marks it done automatically. Your dashboard always reflects reality — no double-work.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-zinc-950 border-b border-zinc-800/60">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Pricing</p>
            <h2 className="text-4xl font-extrabold text-white tracking-tight mb-3">Simple, transparent pricing</h2>
            <p className="text-zinc-400 text-base">30 days free on any plan. No credit card required.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Starter */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Starter</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">$39</span>
                  <span className="text-zinc-400 text-sm">/month</span>
                </div>
                <p className="text-zinc-500 text-sm">For single-location restaurants</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {['1 location', '3 competitor slots', 'AI reply drafts (3 tones)', 'Urgent 1-star alerts', 'Weekly digest', 'Review request campaigns'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-400">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/onboard?plan=starter" className="btn-press block text-center rounded-full border border-zinc-700 text-zinc-100 text-sm font-semibold px-6 py-3 hover:border-zinc-500 hover:bg-zinc-800 transition-colors">
                Start free trial
              </a>
            </div>

            {/* Growth */}
            <div className="rounded-2xl border-2 border-blue-500/50 bg-zinc-900 p-8 flex flex-col relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">Most popular</span>
              </div>
              <div className="mb-6">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">Growth</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">$99</span>
                  <span className="text-zinc-400 text-sm">/month</span>
                </div>
                <p className="text-zinc-500 text-sm">For serious operators</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {['Up to 5 locations', '5 competitor slots', 'Everything in Starter', 'Sentiment analysis & trends', 'Reputation score tracking', 'Monthly PDF reports'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-300">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/onboard?plan=growth" className="btn-press block text-center rounded-full bg-white text-zinc-900 text-sm font-bold px-6 py-3 hover:bg-zinc-100 transition-colors">
                Start free trial
              </a>
            </div>

            {/* Agency */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Agency</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-extrabold text-white">$199</span>
                  <span className="text-zinc-400 text-sm">/month</span>
                </div>
                <p className="text-zinc-500 text-sm">For multi-location groups</p>
              </div>
              <ul className="space-y-3 flex-1 mb-8">
                {['Up to 15 locations', '10 competitor slots', 'Everything in Growth', 'Priority email support', 'Custom reply persona', 'White-label reports'].map(f => (
                  <li key={f} className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-zinc-400">{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/onboard?plan=agency" className="btn-press block text-center rounded-full border border-zinc-700 text-zinc-100 text-sm font-semibold px-6 py-3 hover:border-zinc-500 hover:bg-zinc-800 transition-colors">
                Start free trial
              </a>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-8">Billed monthly · Cancel anytime · No contracts</p>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────── */}
      <section className="py-24 px-6 bg-zinc-950">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-4 leading-tight">
            Your competitors are responding.<br />
            <span className="text-zinc-500">Are you?</span>
          </h2>
          <p className="text-zinc-400 text-base mb-10 leading-relaxed">
            30 days free. Set up in under 5 minutes. No credit card required.
          </p>
          <a
            href="/onboard"
            className="btn-press inline-flex items-center gap-2 rounded-full bg-white text-zinc-900 text-sm font-bold px-8 py-4 hover:bg-zinc-100 transition-colors"
          >
            Start your free trial
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-800/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div style={{ width: 20, height: 20, background: 'oklch(0.62 0.19 258)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-zinc-400">Replova</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="/terms" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Terms</a>
            <a href="/privacy" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="/refunds" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Refunds</a>
            <a href="mailto:support@replova.app" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">Support</a>
            <span className="text-xs text-zinc-700">© {year} Replova</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
