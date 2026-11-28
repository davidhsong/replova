'use client'

import type { ComponentProps } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavDestination(props: ComponentProps<typeof Link>) {
  const current = usePathname() === props.href
  return <Link {...props} aria-current={current ? 'page' : undefined} />
}
