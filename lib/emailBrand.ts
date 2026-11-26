import { BASE_URL } from '@/lib/baseUrl'

export function getEmailLogoUrl(baseUrl = BASE_URL): string {
  return new URL('/brand/social/email-logo.png?v=arrow2', baseUrl).toString()
}
