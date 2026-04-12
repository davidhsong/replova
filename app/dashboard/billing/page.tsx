import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'

type Restaurant = {
  id: string
  name: string
  active: boolean
  stripe_customer_id: string | null
  created_at: string
}

export default async function BillingPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('id, name, active, stripe_customer_id, created_at')
    .eq('owner_email', user.email)
    .single<Restaurant>()

  if (!restaurant) redirect('/onboard')

  const trialStart = new Date(restaurant.created_at)
  const trialEnd = new Date(trialStart)
  trialEnd.setDate(trialEnd.getDate() + 30)
  const now = new Date()
  const inTrial = restaurant.active && now < trialEnd && !restaurant.stripe_customer_id
  const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 fade-up">
        <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">Billing</h1>
        <p className="text-zinc-600 text-sm mt-0.5">Manage your subscription</p>
      </div>

      <div className="space-y-4">

        {/* Subscription status */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30">
          <h2 className="text-sm font-semibold text-zinc-200 mb-5">Subscription</h2>

          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-zinc-100">Replova Monthly</p>
              <p className="text-xs text-zinc-600 mt-0.5">$99 / month</p>
            </div>
            {restaurant.active ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-900/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-950/60 text-red-400 border border-red-900/60">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                Inactive
              </span>
            )}
          </div>

          {inTrial && (
            <div className="bg-amber-950/30 border border-amber-900/40 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm text-amber-300 font-medium">
                Free trial · {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Ends {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · You won&apos;t be charged until then
              </p>
            </div>
          )}

          {!restaurant.active && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-3 mb-5">
              <p className="text-sm text-red-300 font-medium">Subscription inactive</p>
              <p className="text-xs text-red-500 mt-0.5">
                Reactivate below to resume weekly review replies.
              </p>
            </div>
          )}

          {restaurant.stripe_customer_id ? (
            <a
              href="/api/billing-portal"
              className="btn-press inline-flex items-center gap-2 bg-zinc-800 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              Manage subscription
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : restaurant.active ? (
            <a
              href="/api/create-checkout"
              className="btn-press inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white transition-colors"
            >
              Add payment method
            </a>
          ) : (
            <a
              href="/api/create-checkout"
              className="btn-press inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-white transition-colors"
            >
              Reactivate subscription
            </a>
          )}
        </div>

        {/* What's included */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30" style={{ animationDelay: '40ms' }}>
          <h2 className="text-sm font-semibold text-zinc-200 mb-5">What&apos;s included</h2>
          <ul className="space-y-3">
            {[
              'AI-generated reply drafts for every new Google review',
              '3 tone options per review: Professional, Warm, and Brief',
              'Weekly Monday morning email digest',
              'Dashboard to view, search, and copy replies',
              'Auto-detect already-replied reviews',
            ].map(item => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-400">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div className="fade-up border border-zinc-800/80 rounded-2xl p-6 bg-zinc-900/30" style={{ animationDelay: '80ms' }}>
          <h2 className="text-sm font-semibold text-zinc-200 mb-2">Need help?</h2>
          <p className="text-sm text-zinc-500 leading-relaxed">
            Email us at{' '}
            <a
              href="mailto:support@replova.app"
              className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2 transition-colors"
            >
              support@replova.app
            </a>
            {' '}and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

      </div>
    </div>
  )
}
