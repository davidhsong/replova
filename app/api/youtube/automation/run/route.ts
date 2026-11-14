import { getSupabaseAdmin } from '@/lib/supabase'
import { handleYouTubeAutomationRequest } from '@/lib/youtubeAutomationEndpoint'
import { runYouTubeSyncAndDraftAutomation } from '@/lib/youtubeAutomationWorker'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  return handleYouTubeAutomationRequest(request, {
    configuredSecret: process.env.YOUTUBE_AUTOMATION_SECRET,
    run: async () => {
      try {
        const summary = await runYouTubeSyncAndDraftAutomation({
          admin: getSupabaseAdmin(),
        })
        return {
          status: summary.failed > 0 || summary.partial > 0 ? 207 : 200,
          body: summary as unknown as Record<string, unknown>,
        }
      } catch (error) {
        console.error('[YouTube automation] Worker failed:', error instanceof Error ? error.name : 'UnknownError')
        return {
          status: 500,
          body: { error: 'YouTube automation run failed.' },
        }
      }
    },
  })
}
