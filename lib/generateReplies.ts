import { recordUsage } from './apiBudget'
import { createStructuredResponse, OPENAI_MODEL } from './openai'
import { NATURAL_REPLY_STYLE, validateReplyOutput } from './replyStyle'

interface GenerateRepliesParams {
  restaurantName: string
  author: string
  rating: number
  reviewText: string
  persona?: string | null
}

interface ReplyVariants {
  professional: string
  warm: string
  brief: string
}

function sanitize(value: string, maxLen: number): string {
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, maxLen)
}

export async function generateReplies(params: GenerateRepliesParams): Promise<ReplyVariants> {
  const restaurantName = sanitize(params.restaurantName, 200)
  const author = sanitize(params.author, 100)
  const rating = Math.min(5, Math.max(0, Math.round(params.rating)))
  const reviewText = sanitize(params.reviewText, 2000)
  const personaLine = params.persona ? `\nWrite in this voice: ${sanitize(params.persona, 300)}` : ''

  const { data, inputTokens, outputTokens } = await createStructuredResponse<ReplyVariants>({
    name: 'review_reply_variants',
    maxOutputTokens: 800,
    instructions: `You are an expert in customer communication and online reputation management.

Write thoughtful, human, and brand-safe responses to customer reviews for ANY type of business.

Goals:
- Protect the business's reputation
- Show empathy and professionalism
- De-escalate negative feedback
- Reinforce positive experiences

Rules:
- Write like the owner typed the reply themselves
- Never over-apologize or be defensive
- Adapt your tone to the sentiment and content of the review
- Reference specific details mentioned (products, staff, experience, wait times, etc.)
- Never offer discounts or mention competitor names
${personaLine}
${NATURAL_REPLY_STYLE}`,
    input: `Write 3 reply variants for this Google review.

Business: ${restaurantName}
Reviewer: ${author}
Rating: ${rating}/5 stars
Review: "${reviewText}"

Professional: formal business tone, 60-80 words, references specific details.
Warm: friendly and personal, uses the reviewer's first name, 60-80 words.
Brief: concise and genuine, under 40 words.`,
    schema: {
      type: 'object',
      properties: {
        professional: { type: 'string' },
        warm: { type: 'string' },
        brief: { type: 'string' },
      },
      required: ['professional', 'warm', 'brief'],
      additionalProperties: false,
    },
  })

  await recordUsage(OPENAI_MODEL, 'reply_draft', inputTokens, outputTokens)

  if (typeof data.professional !== 'string' || typeof data.warm !== 'string' || typeof data.brief !== 'string') {
    throw new Error('OpenAI response missing required reply fields')
  }

  return {
    professional: validateReplyOutput(data.professional, 1000),
    warm: validateReplyOutput(data.warm, 1000),
    brief: validateReplyOutput(data.brief, 500),
  }
}
