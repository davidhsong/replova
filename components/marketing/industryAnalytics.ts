'use client'

import { sendGAEvent } from '@next/third-parties/google'

type EventName = 'industry_menu_open' | 'industry_select' | 'industry_page_view' | 'demo_cta_click' | 'demo_booking_complete'

// Callers supply catalog slugs only. Never forward form data or raw query parameters.
export function trackIndustry(event: EventName, industry?: string) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_GA_ID) {
    window.dataLayer ??= []
    sendGAEvent('event', event, industry ? { industry_id: industry } : {})
  }
}
