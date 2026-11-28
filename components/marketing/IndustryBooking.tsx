'use client'

import Link from 'next/link'
import { useEffect, type ReactNode } from 'react'
import { trackIndustry } from './industryAnalytics'

export function IndustryPageView({ industry }: { industry: string }) {
  useEffect(() => { trackIndustry('industry_page_view', industry) }, [industry])
  return null
}

export function IndustryDemoLink({ industry, className, children, ...props }: {
  industry?: string; className?: string; children: ReactNode; tabIndex?: number; onClick?: () => void
}) {
  return <Link {...props} className={className} href={industry ? '/demo?industry=' + industry : '/demo'}
    onClick={() => { trackIndustry('demo_cta_click', industry); props.onClick?.() }}>
    {children}
  </Link>
}
