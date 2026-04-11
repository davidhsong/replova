export interface GmbReview {
  name: string // "accounts/xxx/locations/yyy/reviews/zzz"
  reviewer: {
    displayName: string
    isAnonymous: boolean
  }
  starRating: string // "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE"
  comment?: string
  createTime: string  // ISO 8601
  updateTime: string
  reviewReply?: {
    comment: string
    updateTime: string
  }
}

const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

export function starRatingToNumber(starRating: string): number {
  return STAR_MAP[starRating] ?? 0
}

export async function fetchAllGmbReviews(
  accessToken: string,
  locationName: string
): Promise<GmbReview[]> {
  const all: GmbReview[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({ pageSize: '50' })
    if (pageToken) params.set('pageToken', pageToken)

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/reviews?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GMB reviews ${res.status}: ${text}`)
    }

    const data = await res.json() as {
      reviews?: GmbReview[]
      nextPageToken?: string
    }

    all.push(...(data.reviews ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return all
}
