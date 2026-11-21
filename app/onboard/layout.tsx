import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Create a workspace',
  description: 'Verify your email and name your business workspace. A Google listing is optional for Replova Tap.',
  path: '/onboard',
})

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
