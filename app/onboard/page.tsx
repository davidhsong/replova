import AccountSignup from './AccountSignup'
import AddLocationFlow from './AddLocationFlow'

export default async function OnboardPage({ searchParams }: {
  searchParams: Promise<{ add?: string; intent?: string }>
}) {
  const query = await searchParams
  if (query.add === 'true') return <AddLocationFlow connectAfterAdd={query.intent === 'google'} />
  return <AccountSignup />
}
