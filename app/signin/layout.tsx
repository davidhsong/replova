import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Sign In',
  description: 'Sign in to Replova to manage Google reviews, AI reply drafts, and customer insights.',
  path: '/signin',
})

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
