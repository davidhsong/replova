import type { Metadata } from 'next'
import DemoScheduler from './DemoScheduler'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Schedule a Demo',
  description: 'Choose a time to see how Replova turns customer feedback into practical business intelligence and owner-approved improvements.',
  path: '/demo',
})

export default function DemoPage() {
  const now = new Date()

  return (
    <DemoScheduler
      initialYear={now.getFullYear()}
      initialMonth={now.getMonth()}
      initialDay={now.getDate()}
    />
  )
}
