import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Start Free Trial',
}

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
