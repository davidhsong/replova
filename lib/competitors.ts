import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlaceRatingSnapshot, GENERIC_PLACE_TYPES } from '@/lib/places'

export type CompetitorComparison = {
  yourRestaurant: {
    name: string
    avgRating: number | null
    totalReviews: number
    rank: number
  }
  competitors: Array<{
    id: string
    name: string
    googlePlaceId: string
    avgRating: number | null
    totalReviews: number | null
    ratingDelta: number | null
    rank: number
  }>
  totalTracked: number
}

export async function addCompetitor(restaurantId: string, placeId: string, source: 'manual' | 'auto' = 'manual'): Promise<void> {
  const admin = getSupabaseAdmin()

  // Fetch full details: name, address, rating, website, price level, cuisine types
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'name,formatted_address,rating,user_ratings_total,website,price_level,types',
    key: process.env.GOOGLE_PLACES_API_KEY!,
  })
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  )
  const data = await res.json()

  if (data.status !== 'OK') {
    throw new Error(`Google Places details error: ${data.status}`)
  }

  const result = data.result
  const name: string = result.name
  const address: string = result.formatted_address ?? ''
  const rating: number | null = result.rating ?? null
  const totalRatings: number | null = result.user_ratings_total ?? null
  const website: string | null = result.website ?? null
  const priceLevel: number | null = result.price_level ?? null
  const cuisineTags: string[] = ((result.types ?? []) as string[])
    .filter((t: string) => !GENERIC_PLACE_TYPES.has(t))
    .map((t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
    .slice(0, 4)

  const { data: competitor, error } = await admin
    .from('competitors')
    .upsert(
      {
        restaurant_id: restaurantId,
        google_place_id: placeId,
        name,
        address,
        website,
        price_level: priceLevel,
        cuisine_tags: cuisineTags,
        source,
        active: true,
      },
      { onConflict: 'restaurant_id,google_place_id' }
    )
    .select('id')
    .single()

  if (error || !competitor) {
    throw new Error(error?.message ?? 'Failed to upsert competitor')
  }

  await admin.from('competitor_snapshots').upsert(
    {
      competitor_id: competitor.id,
      avg_rating: rating,
      total_reviews: totalRatings,
      snapshot_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'competitor_id,snapshot_date' }
  )
}

export async function syncCompetitorSnapshots(restaurantId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  const { data: competitors } = await admin
    .from('competitors')
    .select('id, google_place_id')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)

  if (!competitors?.length) return

  const today = new Date().toISOString().slice(0, 10)

  await Promise.all(
    competitors.map(async (c) => {
      const { rating, totalRatings } = await getPlaceRatingSnapshot(c.google_place_id)
      await admin.from('competitor_snapshots').upsert(
        {
          competitor_id: c.id,
          avg_rating: rating,
          total_reviews: totalRatings,
          snapshot_date: today,
        },
        { onConflict: 'competitor_id,snapshot_date' }
      )
    })
  )
}

export async function getCompetitorComparison(restaurantId: string): Promise<CompetitorComparison> {
  const admin = getSupabaseAdmin()

  const [restaurantRes, competitorsRes] = await Promise.all([
    admin
      .from('restaurants')
      .select('name')
      .eq('id', restaurantId)
      .single(),
    admin
      .from('competitors')
      .select('id, name, google_place_id')
      .eq('restaurant_id', restaurantId)
      .eq('active', true),
  ])

  const restaurantName: string = restaurantRes.data?.name ?? 'Your Business'
  const activeCompetitors = competitorsRes.data ?? []

  // Get your latest score
  const { data: scoreRow } = await admin
    .from('reputation_scores')
    .select('avg_rating, total_reviews')
    .eq('restaurant_id', restaurantId)
    .order('score_date', { ascending: false })
    .limit(1)
    .single()

  const yourRating: number | null = scoreRow?.avg_rating ?? null
  const yourReviews: number = scoreRow?.total_reviews ?? 0

  // Get latest snapshot for each competitor
  const competitorData = await Promise.all(
    activeCompetitors.map(async (c) => {
      const { data: snap } = await admin
        .from('competitor_snapshots')
        .select('avg_rating, total_reviews')
        .eq('competitor_id', c.id)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .single()

      return {
        id: c.id,
        name: c.name,
        googlePlaceId: c.google_place_id,
        avgRating: snap?.avg_rating ?? null,
        totalReviews: snap?.total_reviews ?? null,
      }
    })
  )

  // Rank all entries by rating descending (nulls last). Keyed by id, not
  // name — two tracked competitors can share an identical name (common for
  // chains/franchises), or a competitor's name can coincidentally match the
  // user's own business name, which would silently collide and misattribute
  // ranks if keyed by name instead.
  const YOU_KEY = '__you__'
  type Entry = { key: string; avgRating: number | null }
  const all: Entry[] = [
    { key: YOU_KEY, avgRating: yourRating },
    ...competitorData.map(c => ({ key: c.id, avgRating: c.avgRating })),
  ]

  all.sort((a, b) => {
    if (a.avgRating === null && b.avgRating === null) return 0
    if (a.avgRating === null) return 1
    if (b.avgRating === null) return -1
    return b.avgRating - a.avgRating
  })

  const rankMap = new Map<string, number>()
  all.forEach((e, i) => rankMap.set(e.key, i + 1))

  const yourRank = rankMap.get(YOU_KEY) ?? 1

  return {
    yourRestaurant: {
      name: restaurantName,
      avgRating: yourRating,
      totalReviews: yourReviews,
      rank: yourRank,
    },
    competitors: competitorData.map(c => ({
      ...c,
      ratingDelta:
        c.avgRating !== null && yourRating !== null
          ? parseFloat((c.avgRating - yourRating).toFixed(2))
          : null,
      rank: rankMap.get(c.id) ?? 99,
    })),
    totalTracked: 1 + activeCompetitors.length,
  }
}

export async function batchSyncAllCompetitors(): Promise<{ synced: number; errors: number }> {
  const admin = getSupabaseAdmin()

  const { data: rows } = await admin
    .from('competitors')
    .select('restaurant_id')
    .eq('active', true)

  const restaurantIds = [...new Set((rows ?? []).map(r => r.restaurant_id))]

  let synced = 0
  let errors = 0

  await Promise.all(
    restaurantIds.map(async (id) => {
      try {
        await syncCompetitorSnapshots(id)
        synced++
      } catch (err) {
        console.error(`Failed to sync competitors for restaurant ${id}:`, err)
        errors++
      }
    })
  )

  return { synced, errors }
}
