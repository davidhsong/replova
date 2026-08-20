import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlaceDetails, getPlaceRatingSnapshot, GENERIC_PLACE_TYPES } from '@/lib/places'

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

  // Places API (New) works for new Google Cloud projects; the legacy Places
  // endpoints used here previously cannot be enabled on newly-created projects.
  const result = await getPlaceDetails(placeId)
  const cuisineTags: string[] = result.types
    .filter((t: string) => !GENERIC_PLACE_TYPES.has(t))
    .map((t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))
    .slice(0, 4)

  const { data: competitor, error } = await admin
    .from('competitors')
    .upsert(
      {
        restaurant_id: restaurantId,
        google_place_id: placeId,
        name: result.name,
        address: result.address,
        website: result.website,
        price_level: result.priceLevel,
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

  const { error: snapshotError } = await admin.from('competitor_snapshots').upsert(
    {
      competitor_id: competitor.id,
      avg_rating: result.rating,
      total_reviews: result.totalRatings,
      snapshot_date: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'competitor_id,snapshot_date' }
  )
  if (snapshotError) throw snapshotError
}

export async function syncCompetitorSnapshots(restaurantId: string): Promise<void> {
  const admin = getSupabaseAdmin()

  const { data: competitors, error: competitorError } = await admin
    .from('competitors')
    .select('id, google_place_id')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
  if (competitorError) throw competitorError

  if (!competitors?.length) return

  const today = new Date().toISOString().slice(0, 10)

  await Promise.all(
    competitors.map(async (c) => {
      const { rating, totalRatings } = await getPlaceRatingSnapshot(c.google_place_id)
      const { error } = await admin.from('competitor_snapshots').upsert(
        {
          competitor_id: c.id,
          avg_rating: rating,
          total_reviews: totalRatings,
          snapshot_date: today,
        },
        { onConflict: 'competitor_id,snapshot_date' }
      )
      if (error) throw error
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

  let yourRating: number | null = scoreRow?.avg_rating ?? null
  let yourReviews: number = scoreRow?.total_reviews ?? 0
  if (!scoreRow) {
    const { data: reviewRows, error: reviewError } = await admin
      .from('reviews')
      .select('rating')
      .eq('restaurant_id', restaurantId)
    if (reviewError) throw reviewError
    const ratings = (reviewRows ?? [])
      .map(review => review.rating)
      .filter((rating): rating is number => rating != null)
    yourReviews = reviewRows?.length ?? 0
    yourRating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null
  }

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
  // name because two tracked competitors can share an identical name (common for
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

  const { data: rows, error: rowsError } = await admin
    .from('competitors')
    .select('restaurant_id')
    .eq('active', true)
  if (rowsError) throw rowsError

  const candidateIds = [...new Set((rows ?? []).map(r => r.restaurant_id))]
  if (candidateIds.length === 0) return { synced: 0, errors: 0 }

  const { data: restaurants, error: restaurantsError } = await admin
    .from('restaurants')
    .select('id, owner_email')
    .in('id', candidateIds)
    .eq('active', true)
  if (restaurantsError) throw restaurantsError

  const ownerEmails = [...new Set((restaurants ?? []).map(restaurant => restaurant.owner_email))]
  const { data: eligibleAccounts, error: accountsError } = ownerEmails.length > 0
    ? await admin.from('accounts').select('owner_email').in('owner_email', ownerEmails).in('plan', ['growth', 'agency'])
    : { data: [], error: null }
  if (accountsError) throw accountsError

  const eligibleEmails = new Set((eligibleAccounts ?? []).map(account => account.owner_email))
  const restaurantIds = (restaurants ?? [])
    .filter(restaurant => eligibleEmails.has(restaurant.owner_email))
    .map(restaurant => restaurant.id)

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
