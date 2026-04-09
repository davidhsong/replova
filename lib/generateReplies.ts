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

export async function generateReplies(params: GenerateRepliesParams): Promise<ReplyVariants> {
  const { restaurantName, author, rating, reviewText } = params

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: `You are an expert restaurant reputation manager writing Google review replies on behalf of restaurant owners.

CRITICAL RULES:
- Every reply MUST reference specific details mentioned in the review (dishes, staff names, atmosphere, wait times, etc.)
- Generic phrases like "Thank you for your feedback!" or "We hope to see you again!" without specifics are NOT acceptable
- Each reply must feel like it was written by a human who actually read the review

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

Restaurant: ${restaurantName}
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
    // Strip any accidental markdown fences and retry
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  }

  return parsed
}
