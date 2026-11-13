import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Review Requests',
}

export default function ReviewRequestsLayout() {
  // The campaign UI is intentionally paused for the simplified MVP. Keeping
  // the implementation in place makes it a one-line restoration later.
  redirect('/dashboard')
}
