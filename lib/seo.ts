import type { Metadata } from 'next'

export const SITE_NAME = 'Replova'
export const SITE_URL = 'https://www.replova.app'
export const SITE_TITLE = 'Replova | Turn feedback into action'
export const SITE_DESCRIPTION =
  'Collect private customer feedback with Replova Tap, see recurring issues at each location, and track the fix with a Playbook.'

// Preview cards should fetch artwork from the deployment being reviewed.
export const BRAND_ORIGIN = process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}` : SITE_URL

export const SITE_SHARE_IMAGE = {
  url: `${BRAND_ORIGIN}/tap-showcase/social.png?v=arrow2`,
  width: 1200,
  height: 630,
  alt: 'Replova Tap with a sample location feedback inbox',
}

type PageMetadataOptions = {
  title: string
  description: string
  path: `/${string}` | '/'
  absoluteTitle?: boolean
}

export function createPageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: PageMetadataOptions): Metadata {
  const socialTitle = absoluteTitle ? title : `${SITE_NAME} | ${title}`

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: path,
      siteName: SITE_NAME,
      images: [SITE_SHARE_IMAGE],
      title: socialTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      images: [SITE_SHARE_IMAGE],
      title: socialTitle,
      description,
      creator: '@Replova',
      site: '@Replova',
    },
  }
}
