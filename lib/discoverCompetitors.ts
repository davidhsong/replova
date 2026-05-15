import Anthropic from '@anthropic-ai/sdk'
import type { PlaceSearchResult } from './places'
import { GENERIC_PLACE_TYPES } from './places'
import { recordUsage } from './apiBudget'

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

export async function discoverCompetitorsWithClaude(
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

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  let claudeResults: DiscoveredCompetitor[] = []

  const businessTypeContext = restaurant.businessType
    ? `IMPORTANT: Only select businesses that are the same type (${restaurant.businessType}) or a direct substitute. Exclude businesses in clearly different categories.`
    : ''

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `You are a local business market analyst. Identify the most relevant competitors for a business from a list of nearby options. A competitor is any place a customer would choose INSTEAD of the given business for the same service.`,
      messages: [{
        role: 'user',
        content: `My business:
Name: ${restaurant.name}
Type: ${restaurant.businessType ?? 'not specified'}

Nearby businesses to evaluate:
${JSON.stringify(formatted, null, 2)}

${businessTypeContext}
Select up to ${maxResults} competitors (or all candidates if fewer than ${maxResults} exist).
Rank them: direct competitors first (same type, similar positioning), then indirect.

Return ONLY a valid JSON array — no markdown, no explanation:
[{"placeId":"...","reason":"one sentence","competitorType":"direct"}]`,
      }],
    })

    recordUsage('claude-haiku-4-5-20251001', 'competitor_discovery', message.usage.input_tokens, message.usage.output_tokens)
    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '[]'
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed: DiscoveredCompetitor[] = JSON.parse(cleaned)
    if (Array.isArray(parsed)) claudeResults = parsed.slice(0, maxResults)
  } catch {
    // Claude failed — fall through to fill slots from candidates
  }

  // Fill any remaining slots with highest-rated candidates Claude didn't pick
  if (claudeResults.length < maxResults) {
    const pickedIds = new Set(claudeResults.map(r => r.placeId))
    const remaining = candidates
      .filter(c => !pickedIds.has(c.placeId))
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, maxResults - claudeResults.length)
      .map(c => ({
        placeId: c.placeId,
        reason: 'Highly-rated nearby business',
        competitorType: 'indirect' as const,
      }))
    claudeResults = [...claudeResults, ...remaining]
  }

  return claudeResults
}
