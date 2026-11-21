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
export type ModelReceipt = {
  model: string
  requestId: string | null
  inputTokens: number
  outputTokens: number
  modelCallMs: number
}

export async function createStructuredResponse<T>({
  name,
  instructions,
  input,
  schema,
  maxOutputTokens,
  signal,
  maxRetries,
  onModelResponse,
}: {
  name: string
  instructions: string
  input: string
  schema: JsonSchema
  maxOutputTokens: number
  signal?: AbortSignal
  maxRetries?: number
  onModelResponse?: (receipt: ModelReceipt) => void
}) {
  const start = performance.now()
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
  }, { signal, ...(maxRetries !== undefined && { maxRetries }) })

  onModelResponse?.({
    model: response.model,
    requestId: response._request_id ?? null,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    modelCallMs: Math.round(performance.now() - start),
  })
  if (!response.output_text) throw new Error('OpenAI returned an empty response')

  return {
    data: JSON.parse(response.output_text) as T,
    model: response.model,
    requestId: response._request_id,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  }
}
