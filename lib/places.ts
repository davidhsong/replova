const API_KEY = process.env.GOOGLE_PLACES_API_KEY

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
