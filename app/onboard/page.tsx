'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AccountSignup from './AccountSignup'
import AddLocationFlow from './AddLocationFlow'

function OnboardContent() {
  const searchParams = useSearchParams()
  if (searchParams.get('add') === 'true') {
    return <AddLocationFlow connectAfterAdd={searchParams.get('intent') === 'google'} />
  }

  return <AccountSignup />
}

export default function OnboardPage() {
  return (
    <Suspense>
      <OnboardContent />
    </Suspense>
  )
}
