const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export interface PlaceSearchResult {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalRatings: number | null
  priceLevel: number | null
  types: string[]
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

export async function searchNearbyPlaces(query: string): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({
    query,
    type: 'restaurant',
    key: API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places textsearch error: ${data.status} — ${data.error_message ?? 'no details'}`)
  }

  return (data.results ?? []).slice(0, 5).map((r: {
    place_id: string
    name: string
    formatted_address: string
    rating?: number
    user_ratings_total?: number
    price_level?: number
    types?: string[]
  }) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    rating: r.rating ?? null,
    totalRatings: r.user_ratings_total ?? null,
    priceLevel: r.price_level ?? null,
    types: r.types ?? [],
  }))
}

export async function getPlaceRatingSnapshot(
  placeId: string
): Promise<{ rating: number | null; totalRatings: number | null }> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'rating,user_ratings_total',
    key: API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Google Places details error: ${data.status} — ${data.error_message ?? 'no details'}`)
  }

  return {
    rating: data.result.rating ?? null,
    totalRatings: data.result.user_ratings_total ?? null,
  }
}

export async function findPlaceId(
  restaurantName: string,
  city: string
): Promise<FindPlaceResult | null> {
  const params = new URLSearchParams({
    input: `${restaurantName} ${city}`,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address',
    key: API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`
  )
  const data = await res.json()

  if (data.status === 'ZERO_RESULTS') return null

  if (data.status !== 'OK') {
    throw new Error(`Google Places findplacefromtext error: ${data.status} — ${data.error_message ?? 'no details'}`)
  }

  const candidate = data.candidates?.[0]
  if (!candidate) return null

  return {
    placeId: candidate.place_id,
    name: candidate.name,
    address: candidate.formatted_address,
  }
}

export const GENERIC_PLACE_TYPES = new Set([
  'restaurant', 'food', 'establishment', 'point_of_interest',
  'store', 'premise', 'geocode',
])

export async function findNearbyCompetitors(
  restaurantPlaceId: string,
  excludePlaceId: string,
  cuisine?: string | null
): Promise<PlaceSearchResult[]> {
  type NearbyResult = {
    place_id: string
    name: string
    vicinity: string
    rating?: number
    user_ratings_total?: number
    price_level?: number
    types?: string[]
  }

  // Step 1: get the restaurant's coordinates and its own cuisine types
  const detailParams = new URLSearchParams({
    place_id: restaurantPlaceId,
    fields: 'geometry,types',
    key: API_KEY!,
  })
  const detailRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${detailParams}`
  )
  const detailData = await detailRes.json()
  if (detailData.status !== 'OK') return []

  const { lat, lng } = detailData.result?.geometry?.location ?? {}
  if (lat == null || lng == null) return []

  const restaurantTypes = new Set<string>(
    ((detailData.result?.types ?? []) as string[]).filter(t => !GENERIC_PLACE_TYPES.has(t))
  )

  // Helper: run a Nearby Search, exclude own place, return raw results
  async function nearbySearch(keyword?: string): Promise<NearbyResult[]> {
    const params = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: '2000',
      type: 'restaurant',
      key: API_KEY!,
    })
    if (keyword) params.set('keyword', keyword)
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params}`)
    const data = await res.json()
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return []
    return ((data.results ?? []) as NearbyResult[]).filter(r => r.place_id !== excludePlaceId)
  }

  let candidates: NearbyResult[] = []

  if (cuisine) {
    // Primary: cuisine-keyword search (Google biases to that type)
    candidates = await nearbySearch(cuisine)

    // Fallback: general search filtered by matching Google place types
    if (candidates.length === 0) {
      const all = await nearbySearch()
      candidates = restaurantTypes.size > 0
        ? all.filter(r => (r.types ?? []).some(t => restaurantTypes.has(t)))
        : all
      // If type filtering also yields nothing, accept any nearby restaurant
      if (candidates.length === 0) candidates = all
    }
  } else {
    candidates = await nearbySearch()
    // Sort same-cuisine types first, then by rating
    candidates.sort((a, b) => {
      const aMatch = restaurantTypes.size > 0 && (a.types ?? []).some(t => restaurantTypes.has(t)) ? 1 : 0
      const bMatch = restaurantTypes.size > 0 && (b.types ?? []).some(t => restaurantTypes.has(t)) ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      return (b.rating ?? 0) - (a.rating ?? 0)
    })
  }

  candidates.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))

  return candidates.slice(0, 20).map(r => ({
    placeId: r.place_id,
    name: r.name,
    address: r.vicinity,
    rating: r.rating ?? null,
    totalRatings: r.user_ratings_total ?? null,
    priceLevel: r.price_level ?? null,
    types: r.types ?? [],
  }))
}

export async function getPlaceReviews(placeId: string): Promise<PlaceReviewsResult> {
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,rating,user_ratings_total,reviews',
    key: API_KEY!,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Google Places details error: ${data.status} — ${data.error_message ?? 'no details'}`)
  }

  const result = data.result

  return {
    restaurantName: result.name,
    overallRating: result.rating,
    totalRatings: result.user_ratings_total,
    // Google Places API returns a maximum of 5 reviews — hard API limit
    reviews: (result.reviews ?? []).map((r: {
      author_name: string
      rating: number
      text: string
      time: number
    }) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      timestamp: r.time,
    })),
  }
}
