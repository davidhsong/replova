import type { MetadataRoute } from 'next'
import { careerRoles } from '@/lib/careerRoles'
import { industrySolutions } from '@/lib/industrySolutions'
import { SITE_URL } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_URL
  const now = new Date()

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/signin`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/demo`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/onboard`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/industries`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/resources`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/resources/customer-review-research`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/careers`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/refunds`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]

  return [
    ...staticRoutes,
    ...careerRoles.map(role => ({
      url: `${base}/careers/${role.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...industrySolutions.map(solution => ({
      url: `${base}/industries/${solution.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.75,
    })),
  ]
}
