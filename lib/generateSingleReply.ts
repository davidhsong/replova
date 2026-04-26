import Anthropic from '@anthropic-ai/sdk'
import { recordUsage } from './apiBudget'

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
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Review by ${author}, ${rating} stars: ${reviewText}`,
      },
    ],
  })

  recordUsage('claude-sonnet-4-6', 'auto_reply', message.usage.input_tokens, message.usage.output_tokens)
  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  if (!text) throw new Error('Claude returned empty reply')
  return text
}
