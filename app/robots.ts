import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/onboard', '/signin', '/privacy', '/terms'],
        disallow: ['/dashboard/', '/api/', '/auth/'],
      },
    ],
    sitemap: 'https://replova.app/sitemap.xml',
    host: 'https://replova.app',
  }
}
