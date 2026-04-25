const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export interface PlaceSearchResult {
  placeId: string
  name: string
  address: string
  rating: number | null
  totalRatings: number | null
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
  }) => ({
    placeId: r.place_id,
    name: r.name,
    address: r.formatted_address,
    rating: r.rating ?? null,
    totalRatings: r.user_ratings_total ?? null,
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
