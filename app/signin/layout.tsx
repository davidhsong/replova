import type { Metadata } from 'next'
import { createPageMetadata } from '@/lib/seo'

export const metadata: Metadata = createPageMetadata({
  title: 'Sign In',
  description: 'Sign in to review private feedback and Playbooks for your locations, or manage your connected Google reviews.',
  path: '/signin',
})

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
