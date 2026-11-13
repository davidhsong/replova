import 'server-only'

import OpenAI from 'openai'

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna'

let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI is not configured')
  if (!client) client = new OpenAI({ apiKey })
  return client
}

type JsonSchema = Record<string, unknown>

export async function createStructuredResponse<T>({
  name,
  instructions,
  input,
  schema,
  maxOutputTokens,
}: {
  name: string
  instructions: string
  input: string
  schema: JsonSchema
  maxOutputTokens: number
}): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  const response = await getOpenAI().responses.create({
    model: OPENAI_MODEL,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: 'low' },
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name,
        strict: true,
        schema,
      },
    },
  })

  if (!response.output_text) throw new Error('OpenAI returned an empty response')

  return {
    data: JSON.parse(response.output_text) as T,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  }
}
