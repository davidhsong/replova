import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import type { Query } from '@/lib/pilot/feedback'
import FeedbackContent from '@/app/dashboard/feedback/FeedbackContent'

export const metadata = { title: 'Feedback flow demo', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'
// A fixed synthetic location on the staging project. No customer-selected tenant or owner actions.
export default async function PreviewFeedback({ searchParams }: { searchParams: Promise<Query> }) {
  if (
    process.env.VERCEL_ENV !== 'preview' ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://yhoblsunpmheyoqtdlvu.supabase.co'
  )
    notFound()
  const location = {
    id: '7170de00-69ce-4280-854c-ba19c7325401',
    name: 'Cedar Studio',
    pilot_timezone: 'America/Los_Angeles',
  }
  const q = await searchParams
  return (
    <>
      <header style={{ padding: '14px 24px', borderBottom: '1px solid #ddd' }}>
        <ReplovaLogo height={24} />
      </header>
      <FeedbackContent
        admin={getSupabaseAdmin()}
        location={location}
        plan="growth"
        demo
        q={{
          ...q,
          location: location.id,
          start: q.start || '2026-11-01',
          end: q.end || '2026-11-30',
        }}
      />
    </>
  )
}
