import type { Metadata } from 'next'
import { connection } from 'next/server'
import DemoScheduler from './DemoScheduler'
import { DEMO_TIME_ZONE } from '@/lib/demoBooking'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Schedule a Demo',
  description: 'Choose a time to see Replova Tap, the private feedback inbox for a location, and the Playbook an owner uses to track a fix.',
  path: '/demo',
})

export default async function DemoPage() {
  await connection()
  const now = new Date()
  const dateParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: DEMO_TIME_ZONE,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]),
  )

  return (
    <DemoScheduler
      initialYear={dateParts.year}
      initialMonth={dateParts.month - 1}
      initialDay={dateParts.day}
    />
  )
}
