import type { PlaceSearchResult } from './places'
import { GENERIC_PLACE_TYPES } from './places'
import { recordUsage } from './apiBudget'
import { createStructuredResponse, OPENAI_MODEL } from './openai'

export interface DiscoveredCompetitor {
  placeId: string
  reason: string
  competitorType: 'direct' | 'indirect'
}

function formatPrice(level: number | null): string {
  if (level === null) return 'unknown'
  return '$'.repeat(Math.max(1, Math.min(4, level)))
}

function formatTypes(types: string[]): string {
  const tags = types.filter(t => !GENERIC_PLACE_TYPES.has(t))
    .map(t => t.replace(/_/g, ' '))
    .slice(0, 3)
  return tags.join(', ') || 'local business'
}

export async function discoverCompetitors(
  restaurant: { name: string; businessType: string | null },
  candidates: PlaceSearchResult[],
  maxResults: number
): Promise<DiscoveredCompetitor[]> {
  if (candidates.length === 0) return []

  const formatted = candidates.map(c => ({
    placeId: c.placeId,
    name: c.name,
    address: c.address,
    rating: c.rating ?? 'no rating',
    reviews: c.totalRatings ?? 0,
    price: formatPrice(c.priceLevel),
    category: formatTypes(c.types),
  }))

  let aiResults: DiscoveredCompetitor[] = []

  const businessTypeContext = restaurant.businessType
    ? `IMPORTANT: Only select businesses that are the same type (${restaurant.businessType}) or a direct substitute. Exclude businesses in clearly different categories.`
    : ''

  try {
    const { data, inputTokens, outputTokens } = await createStructuredResponse<{
      competitors: DiscoveredCompetitor[]
    }>({
      name: 'competitor_selection',
      maxOutputTokens: 2048,
      instructions: 'You are a local business market analyst. Identify the most relevant competitors from nearby options. A competitor is a place a customer would choose instead for a similar product or service. Rank direct competitors before indirect substitutes.',
      input: `My business:
Name: ${restaurant.name}
Type: ${restaurant.businessType ?? 'not specified'}

Nearby businesses to evaluate:
${JSON.stringify(formatted, null, 2)}

${businessTypeContext}
Select up to ${maxResults} competitors (or all candidates if fewer than ${maxResults} exist).
Rank them: direct competitors first (same type, similar positioning), then indirect.`,
      schema: {
        type: 'object',
        properties: {
          competitors: {
            type: 'array',
            maxItems: maxResults,
            items: {
              type: 'object',
              properties: {
                placeId: { type: 'string', enum: candidates.map(candidate => candidate.placeId) },
                reason: { type: 'string' },
                competitorType: { type: 'string', enum: ['direct', 'indirect'] },
              },
              required: ['placeId', 'reason', 'competitorType'],
              additionalProperties: false,
            },
          },
        },
        required: ['competitors'],
        additionalProperties: false,
      },
    })

    await recordUsage(OPENAI_MODEL, 'competitor_discovery', inputTokens, outputTokens)
    const parsed: unknown = data.competitors
    const allowedIds = new Set(candidates.map(candidate => candidate.placeId))
    if (Array.isArray(parsed)) {
      aiResults = parsed
        .filter((item): item is DiscoveredCompetitor => {
          if (!item || typeof item !== 'object') return false
          const candidate = item as Partial<DiscoveredCompetitor>
          return typeof candidate.placeId === 'string'
            && allowedIds.has(candidate.placeId)
            && typeof candidate.reason === 'string'
            && (candidate.competitorType === 'direct' || candidate.competitorType === 'indirect')
        })
        .slice(0, maxResults)
    }
  } catch {
    // AI selection failed, so fill the remaining slots from candidates.
  }

  // Fill any remaining slots with the highest-rated candidates the model did not pick.
  if (aiResults.length < maxResults) {
    const pickedIds = new Set(aiResults.map(r => r.placeId))
    const remaining = candidates
      .filter(c => !pickedIds.has(c.placeId))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, maxResults - aiResults.length)
      .map(c => ({
        placeId: c.placeId,
        reason: 'Highly-rated nearby business',
        competitorType: 'indirect' as const,
      }))
    aiResults = [...aiResults, ...remaining]
  }

  return aiResults
}
