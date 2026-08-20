import { getSupabaseAdmin } from '@/lib/supabase'
import { getPlanLimits, hasCompetitorTracking, type Plan } from '@/lib/planLimits'

export async function setOwnerRestaurantAccess(
  ownerEmail: string,
  active: boolean,
  plan: Plan
): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data: restaurants, error: lookupError } = await admin
    .from('restaurants')
    .select('id')
    .eq('owner_email', ownerEmail)
    .order('created_at', { ascending: true })
  if (lookupError) throw lookupError

  const ids = (restaurants ?? []).map(restaurant => restaurant.id)
  if (ids.length === 0) return

  const { error: deactivateError } = await admin
    .from('restaurants')
    .update({ active: false })
    .in('id', ids)
  if (deactivateError) throw deactivateError

  if (!active) return

  const enabledIds = ids.slice(0, getPlanLimits(plan).locations)
  if (enabledIds.length > 0) {
    const { error: activateError } = await admin
      .from('restaurants')
      .update({ active: true })
      .in('id', enabledIds)
    if (activateError) throw activateError
  }

  const { data: competitors, error: competitorLookupError } = await admin
    .from('competitors')
    .select('id, restaurant_id')
    .in('restaurant_id', ids)
    .eq('active', true)
    .order('created_at', { ascending: true })
  if (competitorLookupError) throw competitorLookupError

  const allowedPerLocation = hasCompetitorTracking(plan) ? getPlanLimits(plan).competitors : 0
  const enabledSet = new Set(enabledIds)
  const seenPerLocation = new Map<string, number>()
  const competitorIdsToDisable: string[] = []
  for (const competitor of competitors ?? []) {
    const seen = seenPerLocation.get(competitor.restaurant_id) ?? 0
    if (!enabledSet.has(competitor.restaurant_id) || seen >= allowedPerLocation) {
      competitorIdsToDisable.push(competitor.id)
    }
    seenPerLocation.set(competitor.restaurant_id, seen + 1)
  }
  if (competitorIdsToDisable.length > 0) {
    const { error: competitorUpdateError } = await admin
      .from('competitors')
      .update({ active: false })
      .in('id', competitorIdsToDisable)
    if (competitorUpdateError) throw competitorUpdateError
  }
}
