const PLACES_BASE_URL = 'https://places.googleapis.com/v1'

export interface PlaceSearchResult {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalRatings: number | null
  priceLevel: number | null
  types: string[]
}

export interface PlaceDetailsResult extends PlaceSearchResult {
  website: string | null
  location: { latitude: number; longitude: number } | null
  primaryType: string | null
}

interface FindPlaceResult {
  placeId: string
  name: string
  address: string
}

interface Review {
  author: string
  rating: number
  text: string
  timestamp: number
}

interface PlaceReviewsResult {
  restaurantName: string
  overallRating: number
  totalRatings: number
  reviews: Review[]
}

type GooglePlace = {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  types?: string[]
  websiteUri?: string
  location?: { latitude?: number; longitude?: number }
  primaryType?: string
  reviews?: Array<{
    authorAttribution?: { displayName?: string }
    rating?: number
    text?: { text?: string }
    publishTime?: string
  }>
}

const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.types',
].join(',')

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('Google Places is not configured')
  return key
}

async function parseGoogleResponse<T>(res: Response, operation: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(`${operation} failed: ${body?.error?.message ?? `Google returned HTTP ${res.status}`}`)
  }
  return res.json() as Promise<T>
}

async function textSearch(
  textQuery: string,
  pageSize: number,
  locationBias?: { latitude: number; longitude: number; radius: number }
): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = { textQuery, pageSize }
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: locationBias.latitude,
          longitude: locationBias.longitude,
        },
        radius: locationBias.radius,
      },
    }
  }

  const res = await fetch(`${PLACES_BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': SEARCH_FIELDS,
    },
    body: JSON.stringify(body),
  })

  const data = await parseGoogleResponse<{ places?: GooglePlace[] }>(res, 'Google Places search')
  return data.places ?? []
}

function priceLevelToNumber(priceLevel?: string): number | null {
  const map: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  }
  return priceLevel ? (map[priceLevel] ?? null) : null
}

function toSearchResult(place: GooglePlace): PlaceSearchResult | null {
  if (!place.id || !place.displayName?.text) return null
  return {
    placeId: place.id,
    name: place.displayName.text,
    address: place.formattedAddress ?? '',
    rating: place.rating ?? null,
    totalRatings: place.userRatingCount ?? null,
    priceLevel: priceLevelToNumber(place.priceLevel),
    types: place.types ?? [],
  }
}

export async function searchNearbyPlaces(query: string): Promise<PlaceSearchResult[]> {
  const places = await textSearch(query, 5)
  return places.map(toSearchResult).filter((place): place is PlaceSearchResult => place !== null)
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  if (!placeId.trim()) throw new Error('Google Place ID is required')

  const fields = [
    'id',
    'displayName',
    'formattedAddress',
    'rating',
    'userRatingCount',
    'priceLevel',
    'types',
    'websiteUri',
    'location',
    'primaryType',
  ].join(',')

  const res = await fetch(`${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': fields,
    },
  })
  const place = await parseGoogleResponse<GooglePlace>(res, 'Google Place details')
  const result = toSearchResult(place)
  if (!result) throw new Error('Google Place details were incomplete')

  const latitude = place.location?.latitude
  const longitude = place.location?.longitude
  return {
    ...result,
    website: place.websiteUri ?? null,
    location: latitude != null && longitude != null ? { latitude, longitude } : null,
    primaryType: place.primaryType ?? null,
  }
}

export async function getPlaceRatingSnapshot(
  placeId: string
): Promise<{ rating: number | null; totalRatings: number | null }> {
  const details = await getPlaceDetails(placeId)
  return { rating: details.rating, totalRatings: details.totalRatings }
}

export async function findPlaceId(
  restaurantName: string,
  city: string
): Promise<FindPlaceResult | null> {
  const places = await textSearch(`${restaurantName} ${city}`, 1)
  const result = places.map(toSearchResult).find((place): place is PlaceSearchResult => place !== null)
  return result
    ? { placeId: result.placeId, name: result.name, address: result.address }
    : null
}

export const GENERIC_PLACE_TYPES = new Set([
  'restaurant', 'food', 'establishment', 'point_of_interest',
  'store', 'premise', 'geocode',
])

export async function findNearbyCompetitors(
  restaurantPlaceId: string,
  excludePlaceId: string,
  businessType?: string | null
): Promise<PlaceSearchResult[]> {
  const origin = await getPlaceDetails(restaurantPlaceId)
  if (!origin.location) return []

  const query = businessType && businessType !== 'establishment'
    ? businessType.replace(/_/g, ' ')
    : (origin.primaryType ?? origin.types.find(type => !GENERIC_PLACE_TYPES.has(type)) ?? 'local business')
      .replace(/_/g, ' ')

  const places = await textSearch(query, 20, {
    latitude: origin.location.latitude,
    longitude: origin.location.longitude,
    radius: 8000,
  })

  const candidates = places
    .map(toSearchResult)
    .filter((place): place is PlaceSearchResult => place !== null && place.placeId !== excludePlaceId)

  candidates.sort((a, b) => {
    const aMatch = a.types.some(type => origin.types.includes(type) && !GENERIC_PLACE_TYPES.has(type)) ? 1 : 0
    const bMatch = b.types.some(type => origin.types.includes(type) && !GENERIC_PLACE_TYPES.has(type)) ? 1 : 0
    if (bMatch !== aMatch) return bMatch - aMatch
    return (b.rating ?? 0) - (a.rating ?? 0)
  })

  return candidates.slice(0, 20)
}

export async function getPlaceReviews(placeId: string): Promise<PlaceReviewsResult> {
  if (!placeId.trim()) throw new Error('Google Place ID is required')

  const res = await fetch(`${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': getApiKey(),
      'X-Goog-FieldMask': 'displayName,rating,userRatingCount,reviews',
    },
  })
  const place = await parseGoogleResponse<GooglePlace>(res, 'Google Place reviews')

  return {
    restaurantName: place.displayName?.text ?? 'Business',
    overallRating: place.rating ?? 0,
    totalRatings: place.userRatingCount ?? 0,
    // Places API returns a small representative review sample. Connecting a
    // Business Profile unlocks the complete review history.
    reviews: (place.reviews ?? []).map(review => ({
      author: review.authorAttribution?.displayName ?? 'Anonymous',
      rating: review.rating ?? 0,
      text: review.text?.text ?? '',
      timestamp: review.publishTime
        ? Math.floor(new Date(review.publishTime).getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    })),
  }
}
