import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface GenerateRepliesParams {
  restaurantName: string
  author: string
  rating: number
  reviewText: string
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

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are an expert in customer communication and online reputation management.

Write thoughtful, human, and brand-safe responses to customer reviews for ANY type of business.

Goals:
- Protect the business's reputation
- Show empathy and professionalism
- De-escalate negative feedback
- Reinforce positive experiences

Rules:
- Never sound robotic or corporate
- Never over-apologize or be defensive
- Adapt your tone to the sentiment and content of the review
- Reference specific details mentioned (products, staff, experience, wait times, etc.)
- Be concise but thoughtful — avoid filler phrases
- Avoid generic openers like "Thank you for your feedback!" without any substance
- Each response should feel like it was written by a high-quality, attentive business owner

Return ONLY a valid JSON object with exactly these three keys:
{
  "professional": "formal business tone, 60-80 words, references specific review details",
  "warm": "friendly and personal tone, uses reviewer's first name, 60-80 words, references specific review details",
  "brief": "concise and genuine, under 40 words, references specific review details"
}

No markdown, no explanation, no code blocks — raw JSON only.`,
    messages: [
      {
        role: 'user',
        content: `Write 3 reply variants for this Google review.

Business: ${restaurantName}
Reviewer: ${author}
Rating: ${rating}/5 stars
Review: "${reviewText}"`,
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  let parsed: ReplyVariants
  try {
    parsed = JSON.parse(raw)
  } catch {
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      throw new Error(`Claude returned unparseable JSON: ${raw.slice(0, 200)}`)
    }
  }

  if (
    typeof parsed.professional !== 'string' ||
    typeof parsed.warm !== 'string' ||
    typeof parsed.brief !== 'string'
  ) {
    throw new Error('Claude response missing required reply fields')
  }

  return parsed
}
