import PilotOverview from './PilotOverview'
import Reviews from './reviews/page'

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; welcome?: string }>
}) {
  if ((await searchParams).success) return <Reviews searchParams={searchParams} />
  return <PilotOverview />
}
