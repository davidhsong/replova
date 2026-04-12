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
    // Strip any accidental markdown fences and retry
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    parsed = JSON.parse(cleaned)
  }

  return parsed
}
