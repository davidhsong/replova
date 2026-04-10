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
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-zinc-100">Billing</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage your subscription</p>
      </div>

      <div className="space-y-4">

        {/* Subscription status */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Subscription status</h2>

          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">Replova Monthly</p>
              <p className="text-xs text-zinc-500 mt-0.5">$99 / month</p>
            </div>
            {restaurant.active ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950 text-emerald-400 border border-emerald-900">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-950 text-red-400 border border-red-900">
                Inactive
              </span>
            )}
          </div>

          {inTrial && (
            <div className="bg-amber-950/40 border border-amber-900/50 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-amber-300">
                Free trial · <span className="font-medium">{daysLeft} days remaining</span>
              </p>
              <p className="text-xs text-amber-500 mt-0.5">
                Your trial ends {trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                You won&apos;t be charged until then.
              </p>
            </div>
          )}

          {!restaurant.active && (
            <div className="bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-3 mb-4">
              <p className="text-sm text-red-300 font-medium">Your subscription is inactive</p>
              <p className="text-xs text-red-400 mt-0.5">
                Your account has been paused. Reactivate below to resume weekly review replies.
              </p>
            </div>
          )}

          {restaurant.stripe_customer_id ? (
            <a
              href="/api/billing-portal"
              className="inline-block bg-zinc-700 text-zinc-100 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Manage subscription →
            </a>
          ) : restaurant.active ? (
            <a
              href="/api/create-checkout"
              className="inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-white transition-colors"
            >
              Add payment method
            </a>
          ) : (
            <a
              href="/api/create-checkout"
              className="inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-white transition-colors"
            >
              Reactivate subscription
            </a>
          )}
        </div>

        {/* What's included */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">What&apos;s included</h2>
          <ul className="space-y-2">
            {[
              'AI-generated reply drafts for every new Google review',
              '3 tone options per review: Professional, Warm, and Brief',
              'Weekly Monday morning email digest',
              'Dashboard to view, search, and copy replies',
            ].map(item => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-400">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Help */}
        <div className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/40">
          <h2 className="text-sm font-medium text-zinc-300 mb-2">Need help?</h2>
          <p className="text-sm text-zinc-500">
            Email us at{' '}
            <a href="mailto:support@replova.app" className="text-zinc-300 hover:text-zinc-100 underline underline-offset-2">
              support@replova.app
            </a>
            {' '}and we&apos;ll get back to you within 24 hours.
          </p>
        </div>

      </div>
    </div>
  )
}
