import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

export const ACTIVE_LOCATION_COOKIE = 'active_restaurant_id'

export function getActiveRestaurantId(
  cookieStore: ReadonlyRequestCookies
): string | null {
  return cookieStore.get(ACTIVE_LOCATION_COOKIE)?.value ?? null
}
