import { pilotContext } from '@/lib/pilot/access'
import type { Query } from '@/lib/pilot/feedback'
import { Setup } from '../PilotSetup'
import { notFound } from 'next/navigation'
import { BookmarkLocation } from '../BookmarkLocation'
import FeedbackContent from './FeedbackContent'

export default async function Feedback({ searchParams }: { searchParams: Promise<Query> }) {
  const ctx = await pilotContext()
  const l = ctx.location
  if (!l) return <Setup name={ctx.workspace.name} />
  const q = await searchParams
  if (q.location && q.location !== l.id) {
    const target = ctx.locations.find((row) => row.id === q.location)
    if (!target) notFound()
    return <BookmarkLocation id={target.id} name={target.name} />
  }
  return <FeedbackContent admin={ctx.admin} location={l} q={q} plan={ctx.account.plan} />
}
