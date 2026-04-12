import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import ReviewList from './ReviewList'

type Restaurant = {
  id: string
  name: string
  active: boolean
  owner_email: string
  place_id: string
  stripe_customer_id: string | null
  created_at: string
}

type Review = {
  id: string
  restaurant_id: string
  author: string | null
  rating: number | null
  review_text: string | null
  reply_draft_1: string | null
  reply_draft_2: string | null
  reply_draft_3: string | null
  status: string | null
  review_timestamp: number | null
  replied_at: string | null
  created_at: string
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const params = await searchParams

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')

  const { data: restaurant } = await getSupabaseAdmin()
    .from('restaurants')
    .select('*')
    .eq('owner_email', user.email)
    .single<Restaurant>()

  if (!restaurant) redirect('/onboard')

  if (!restaurant.active) {
    return (
      <div className="flex items-center justify-center px-4 py-24">
        <div className="max-w-sm w-full text-center fade-up">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-6">
            <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-100 mb-2">Activate your trial</h1>
          <p className="text-zinc-500 text-sm leading-relaxed mb-8">
            Start your free 30-day trial to get AI suggested replies for every customer review at{' '}
            <span className="text-zinc-300">{restaurant.name}</span>.
          </p>
          <a
            href="/api/create-checkout"
            className="btn-press inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-6 py-3 rounded-full hover:bg-white transition-colors"
          >
            Start your free 30-day trial
          </a>
          <p className="mt-4 text-xs text-zinc-700">No credit card required · Cancel anytime</p>
        </div>
      </div>
    )
  }

  const { data: reviews } = await getSupabaseAdmin()
    .from('reviews')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .returns<Review[]>()

  const needsReplyCount = reviews?.filter(r => r.status !== 'replied').length ?? 0
  const urgentCount = reviews?.filter(r => r.status !== 'replied' && r.rating != null && r.rating <= 2).length ?? 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">

      {/* Success banner */}
      {params.success && (
        <div className="mb-6 flex items-center gap-3 bg-emerald-950/60 border border-emerald-900 rounded-xl px-4 py-3 fade-up">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-300">
            You&apos;re all set. Your first review digest arrives soon.
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4 fade-up">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">{restaurant.name}</h1>
          <p className="text-zinc-600 text-sm mt-0.5">Review Action Center</p>
        </div>
      </div>

      {/* Action center summary */}
      {reviews && reviews.length > 0 && (
        <div className={`mb-6 flex items-center gap-3 rounded-xl px-4 py-3 border fade-up ${
          urgentCount > 0
            ? 'bg-red-950/30 border-red-900/50'
            : needsReplyCount > 0
            ? 'bg-amber-950/30 border-amber-900/50'
            : 'bg-emerald-950/30 border-emerald-900/50'
        }`}>
          {urgentCount > 0 ? (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          ) : needsReplyCount > 0 ? (
            <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <p className={`text-sm font-medium ${
            urgentCount > 0 ? 'text-red-300' : needsReplyCount > 0 ? 'text-amber-300' : 'text-emerald-300'
          }`}>
            {urgentCount > 0
              ? `${urgentCount} urgent review${urgentCount > 1 ? 's' : ''} need${urgentCount === 1 ? 's' : ''} immediate attention`
              : needsReplyCount > 0
              ? `You have ${needsReplyCount} customer review${needsReplyCount > 1 ? 's' : ''} that need${needsReplyCount === 1 ? 's' : ''} a reply`
              : 'All caught up — no reviews waiting for a reply'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!reviews || reviews.length === 0 ? (
        <div className="border border-zinc-800 rounded-2xl p-14 text-center fade-up">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-5">
            <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
            </svg>
          </div>
          <p className="text-zinc-300 font-medium mb-1.5">No customer reviews yet</p>
          <p className="text-zinc-600 text-sm max-w-xs mx-auto leading-relaxed">
            Your reviews will appear here as they&apos;re collected. Check back soon.
          </p>
        </div>
      ) : (
        <ReviewList reviews={reviews} restaurantName={restaurant.name} />
      )}
    </div>
  )
}
