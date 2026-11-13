import type { Metadata } from 'next'
import DemoScheduler from './DemoScheduler'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Request a Demo',
  description: 'Choose a time to see how Replova turns Google reviews into thoughtful replies and practical business intelligence.',
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
