import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Start Free Trial',
  description: 'Find your business on Google and start managing reviews and customer feedback with Replova.',
  path: '/onboard',
})

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
