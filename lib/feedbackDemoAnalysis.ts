import 'server-only'

import { createStructuredResponse, OPENAI_MODEL } from '@/lib/openai'
import type { DemoFeedbackEntry } from '@/lib/feedbackDemo'
import {
  buildFeedbackAnalysisInput,
  normalizeFeedbackAnalysis,
  type RawFeedbackAnalysis,
} from '@/lib/feedbackDemoAnalysisCore'

const analysisSchema = {
  type: 'object',
  properties: {
    executiveSummary: { type: 'string', minLength: 40, maxLength: 500 },
    findings: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 5, maxLength: 100 },
          theme: { type: 'string', minLength: 3, maxLength: 60 },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          summary: { type: 'string', minLength: 20, maxLength: 360 },
          recommendation: { type: 'string', minLength: 20, maxLength: 600 },
          supportingFeedbackIds: {
            type: 'array',
            minItems: 2,
            maxItems: 16,
            items: { type: 'string', pattern: '^feedback-[0-9]{3}$' },
          },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
        required: ['title', 'theme', 'severity', 'summary', 'recommendation', 'supportingFeedbackIds', 'confidence'],
        additionalProperties: false,
      },
    },
    themes: {
      type: 'array',
      minItems: 4,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 60 },
          sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative', 'mixed'] },
          summary: { type: 'string', minLength: 12, maxLength: 240 },
          supportingFeedbackIds: {
            type: 'array',
            minItems: 2,
            maxItems: 20,
            items: { type: 'string', pattern: '^feedback-[0-9]{3}$' },
          },
        },
        required: ['name', 'sentiment', 'summary', 'supportingFeedbackIds'],
        additionalProperties: false,
      },
    },
  },
  required: ['executiveSummary', 'findings', 'themes'],
  additionalProperties: false,
} as const

export async function analyzeFeedbackDemo(entries: DemoFeedbackEntry[]) {
  if (entries.length < 3 || entries.length > 60) {
    throw new Error('Feedback demo analysis requires between 3 and 60 entries.')
  }

  const { data, inputTokens, outputTokens } = await createStructuredResponse<RawFeedbackAnalysis>({
    name: 'feedback_operations_analysis',
    maxOutputTokens: 2400,
    instructions:
      'You are an operations analyst for an independent local auto repair and detailing business. ' +
      'Analyze only the fictional feedback records provided. Detect recurring operational patterns, not isolated anecdotes. ' +
      'Return 3 to 5 distinct findings ordered by customer impact and frequency, plus 4 to 8 recurring themes. ' +
      'Every finding and theme must cite only exact feedback IDs from the input. Use at least two supporting records for every pattern. ' +
      'Each recommendation must be a specific, practical, measurable shop-process test that a single-location owner can run within 30 days. Keep each recommendation under 55 words and finish the thought completely. ' +
      'Different problems must receive materially different recommendations. Do not recommend review gating, incentives, hiding criticism, or publishing anything externally. ' +
      'Do not claim that a change caused an outcome. Use plain language, no hype, no emojis, and no em dashes.',
    input: buildFeedbackAnalysisInput(entries),
    schema: analysisSchema,
  })

  return {
    analysis: normalizeFeedbackAnalysis(data, entries, new Date().toISOString(), OPENAI_MODEL),
    inputTokens,
    outputTokens,
  }
}
