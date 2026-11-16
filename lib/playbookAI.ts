import 'server-only'

import { createStructuredResponse, OPENAI_MODEL } from '@/lib/openai'
import {
  type PlaybookPerson,
  type PlaybookProcedure,
  type PlaybookRole,
} from '@/lib/playbook'
import {
  buildPlaybookAIInput,
  normalizePlaybookAIProposals,
  PLAYBOOK_AI_INSTRUCTIONS,
  PLAYBOOK_PROPOSAL_SCHEMA,
  type PlaybookFeedbackForAI,
  type RawPlaybookProposal,
} from '@/lib/playbookAICore'

export type { PlaybookAIProposal } from '@/lib/playbookAIContract'

export async function analyzePlaybookImprovements({
  feedback,
  procedures,
  roles,
  people,
  demo = false,
}: {
  feedback: PlaybookFeedbackForAI[]
  procedures: PlaybookProcedure[]
  roles: PlaybookRole[]
  people: PlaybookPerson[]
  demo?: boolean
}) {
  if (feedback.length < 3 || feedback.length > 60) {
    throw new Error('Playbook analysis requires between 3 and 60 feedback records.')
  }

  const { data, inputTokens, outputTokens } = await createStructuredResponse<{ proposals: RawPlaybookProposal[] }>({
    name: 'playbook_improvement_proposals',
    maxOutputTokens: 3000,
    instructions: PLAYBOOK_AI_INSTRUCTIONS,
    input: buildPlaybookAIInput({ feedback, procedures, roles, people, demo }),
    schema: PLAYBOOK_PROPOSAL_SCHEMA,
  })

  const proposals = normalizePlaybookAIProposals(data.proposals, feedback, procedures, roles, people, demo)
  if (proposals.length < 1 || proposals.length > 3) throw new Error('AI returned an invalid number of proposals.')

  return { proposals, inputTokens, outputTokens, model: OPENAI_MODEL }
}
