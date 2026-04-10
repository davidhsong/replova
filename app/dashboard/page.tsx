import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import CopyButton from './CopyButton'

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

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-400 text-lg">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  const emailed = status === 'emailed'
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        emailed
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-600'
      }`}
    >
      {emailed ? 'Emailed' : 'Drafted'}
    </span>
  )
}

const REPLY_LABELS = [
  { label: 'Professional', field: 'reply_draft_1' },
  { label: 'Warm', field: 'reply_draft_2' },
  { label: 'Brief', field: 'reply_draft_3' },
] as const

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[dashboard] user:', user?.email, 'error:', userError?.message)
  if (!user) redirect('/onboard')

  const { data: restaurant, error: restaurantError } = await getSupabaseAdmin()
    .from('restaurants')
    .select('*')
    .eq('owner_email', user.email)
    .single<Restaurant>()
  console.log('[dashboard] restaurant:', restaurant?.id, 'error:', restaurantError?.message)

  if (!restaurant) redirect('/onboard')

  if (!restaurant.active) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-gray-900 mb-3">
            Your account is almost ready.
          </h1>
          <p className="text-gray-500 mb-8">
            Start your free trial to activate review replies for {restaurant.name}.
          </p>
          <a
            href="/api/create-checkout"
            className="inline-block bg-indigo-600 text-white font-medium px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start your free 30-day trial
          </a>
        </div>
      </main>
    )
  }

  const { data: reviews } = await getSupabaseAdmin()
    .from('reviews')
    .select('*')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: false })
    .returns<Review[]>()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Review Replies Dashboard</p>
        </div>

        {!reviews || reviews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-500 text-lg">
              Your first weekly digest will arrive next Monday morning.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {review.author ?? 'Anonymous'}
                    </p>
                    {review.rating != null && (
                      <StarRating rating={review.rating} />
                    )}
                  </div>
                  <StatusBadge status={review.status} />
                </div>

                {review.review_text && (
                  <p className="text-gray-700 text-sm leading-relaxed mb-5">
                    {review.review_text}
                  </p>
                )}

                <div className="space-y-4">
                  {REPLY_LABELS.map(({ label, field }) => {
                    const text = review[field]
                    if (!text) return null
                    return (
                      <div key={field} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {label}
                          </span>
                          <CopyButton text={text} />
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">{text}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
