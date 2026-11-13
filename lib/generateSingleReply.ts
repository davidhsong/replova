import { recordUsage } from './apiBudget'
import { getOpenAI, OPENAI_MODEL } from './openai'

interface GenerateSingleReplyParams {
  restaurantName: string
  author: string
  rating: number
  reviewText: string
  persona: string | null
}

function sanitize(value: string, maxLen: number): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, maxLen)
}

export async function generateSingleReply(params: GenerateSingleReplyParams): Promise<string> {
  const restaurantName = sanitize(params.restaurantName, 200)
  const author = sanitize(params.author, 100)
  const rating = Math.min(5, Math.max(1, Math.round(params.rating)))
  const reviewText = sanitize(params.reviewText, 2000)

  const personaLine = params.persona ? `Write in this voice: ${sanitize(params.persona, 500)}` : ''

  const systemPrompt = `You are replying to a Google review on behalf of ${restaurantName}.
Be professional, warm, and specific to what was written.
Keep replies under 150 words.
1-2 stars: acknowledge issue, apologize sincerely, invite them back.
3 stars: thank them, acknowledge mixed experience, invite feedback.
4-5 stars: express genuine gratitude, mention something specific from their review.
Never offer discounts or mention competitor names.${personaLine ? `\n${personaLine}` : ''}`

  const response = await getOpenAI().responses.create({
    model: OPENAI_MODEL,
    instructions: systemPrompt,
    input: `Review by ${author}, ${rating} stars: ${reviewText}`,
    max_output_tokens: 300,
    reasoning: { effort: 'low' },
    store: false,
  })

  await recordUsage(
    OPENAI_MODEL,
    'auto_reply',
    response.usage?.input_tokens ?? 0,
    response.usage?.output_tokens ?? 0
  )
  const text = response.output_text.trim()
  if (!text) throw new Error('OpenAI returned an empty reply')
  return text
}
