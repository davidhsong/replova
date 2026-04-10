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
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-6">
            <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-zinc-100 mb-2">Almost there</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Activate your free trial to start receiving AI reply drafts for{' '}
            {restaurant.name} every Monday.
          </p>
          <a
            href="/api/create-checkout"
            className="inline-block bg-zinc-100 text-zinc-900 text-sm font-semibold px-6 py-3 rounded-lg hover:bg-white transition-colors"
          >
            Start your free 30-day trial
          </a>
          <p className="mt-4 text-xs text-zinc-600">No credit card required · Cancel anytime</p>
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">

      {/* Success banner */}
      {params.success && (
        <div className="mb-6 flex items-center gap-3 bg-emerald-950/60 border border-emerald-900 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-emerald-300">
            You&apos;re all set. Your first digest arrives next Monday morning.
          </p>
        </div>
      )}

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">{restaurant.name}</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Review reply drafts</p>
      </div>

      {/* Empty state */}
      {!reviews || reviews.length === 0 ? (
        <div className="border border-zinc-800 rounded-xl p-12 text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
            </svg>
          </div>
          <p className="text-zinc-300 font-medium mb-1">Nothing here yet</p>
          <p className="text-zinc-500 text-sm">
            Your first weekly digest will arrive next Monday morning.
          </p>
        </div>
      ) : (
        <ReviewList reviews={reviews} />
      )}
    </div>
  )
}
