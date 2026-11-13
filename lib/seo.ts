import type { Metadata } from 'next'

export const SITE_NAME = 'Replova'
export const SITE_URL = 'https://www.replova.app'
export const SITE_TITLE = 'Replova | AI Review Management & Customer Insights'
export const SITE_DESCRIPTION =
  'Replova helps businesses manage Google reviews with AI-powered replies, sentiment analysis, competitor tracking, and actionable customer insights.'

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
      title: socialTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: socialTitle,
      description,
      creator: '@Replova',
      site: '@Replova',
    },
  }
}
