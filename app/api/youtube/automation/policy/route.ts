import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_YOUTUBE_CATEGORY_RULES,
  parseEligibleVideoIds,
  parseYouTubeCategoryRules,
  type YouTubePublishingMode,
  type YouTubeVideoFilterMode,
} from '@/lib/youtubeAutoPublishPolicy'
import { getYouTubeAutomationAccess, mutationGuard } from '@/lib/youtubeAutomationControls'

type SettingsRow = {
  publishing_mode: YouTubePublishingMode
  emergency_paused: boolean
  category_rules: Record<string, unknown>
  max_auto_publishes_per_day: number
  min_auto_publish_confidence: number
  reply_delay_minutes: number
  commenter_cooldown_hours: number
  eligible_video_filter_mode: YouTubeVideoFilterMode
  eligible_video_ids: string[]
  auto_publish_enabled: boolean
  auto_publish_authorized_at: string | null
  auto_publish_consent_version: string | null
  auto_publish_consent_scope_hash: string | null
  auto_publish_revoked_at: string | null
  updated_at: string
}

const SELECT_FIELDS = 'publishing_mode, emergency_paused, category_rules, max_auto_publishes_per_day, min_auto_publish_confidence, reply_delay_minutes, commenter_cooldown_hours, eligible_video_filter_mode, eligible_video_ids, auto_publish_enabled, auto_publish_authorized_at, auto_publish_consent_version, auto_publish_consent_scope_hash, auto_publish_revoked_at, updated_at'

async function loadSettings(access: Awaited<ReturnType<typeof getYouTubeAutomationAccess>> & { ok: true }) {
  await access.admin.from('youtube_automation_settings')
    .upsert({ connection_id: access.connection.id }, { onConflict: 'connection_id', ignoreDuplicates: true })
  const { data, error } = await access.admin.from('youtube_automation_settings')
    .select(SELECT_FIELDS).eq('connection_id', access.connection.id).single<SettingsRow>()
  if (error) throw new Error(`settings_load_${error.code}`)
  return data
}

function responseFor(row: SettingsRow) {
  const rules = parseYouTubeCategoryRules(row.category_rules) ?? DEFAULT_YOUTUBE_CATEGORY_RULES
  const consentCurrent = row.publishing_mode === 'auto_publish'
    && row.auto_publish_authorized_at !== null
    && row.auto_publish_consent_version === 'youtube-auto-publish-v1'
    && row.auto_publish_consent_scope_hash !== null
    && row.auto_publish_revoked_at === null
  return {
    publishingMode: row.publishing_mode,
    emergencyPaused: row.emergency_paused,
    categoryRules: rules,
    maxAutoPublishesPerDay: row.max_auto_publishes_per_day,
    minimumConfidence: Number(row.min_auto_publish_confidence),
    replyDelayMinutes: row.reply_delay_minutes,
    commenterCooldownHours: row.commenter_cooldown_hours,
    eligibleVideoFilter: {
      mode: row.eligible_video_filter_mode,
      videoIds: row.eligible_video_ids,
    },
    consent: {
      current: consentCurrent,
      grantedAt: row.auto_publish_authorized_at,
      revokedAt: row.auto_publish_revoked_at,
      version: row.auto_publish_consent_version,
    },
    runtimeEnabled: false,
    updatedAt: row.updated_at,
  }
}

export async function GET() {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  try {
    return NextResponse.json(responseFor(await loadSettings(access)))
  } catch (error) {
    console.error('[YouTube automation policy] Load failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Unable to load auto-publish settings.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const access = await getYouTubeAutomationAccess()
  if (!access.ok) return access.error
  const guard = mutationGuard(request, access.userId)
  if (guard) return guard

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  const rules = parseYouTubeCategoryRules(body.categoryRules)
  const videoIds = parseEligibleVideoIds(body.eligibleVideoIds)
  const maxDaily = body.maxAutoPublishesPerDay
  const minimumConfidence = body.minimumConfidence
  const delay = body.replyDelayMinutes
  const cooldown = body.commenterCooldownHours
  const filterMode = body.eligibleVideoFilterMode
  const expectedUpdatedAt = body.expectedUpdatedAt
  if (!rules || !videoIds
    || !Number.isInteger(maxDaily) || (maxDaily as number) < 1 || (maxDaily as number) > 500
    || typeof minimumConfidence !== 'number' || !Number.isFinite(minimumConfidence) || minimumConfidence < 0 || minimumConfidence > 1
    || !Number.isInteger(delay) || (delay as number) < 0 || (delay as number) > 10080
    || !Number.isInteger(cooldown) || (cooldown as number) < 0 || (cooldown as number) > 8760
    || !['all', 'include', 'exclude'].includes(String(filterMode))
    || (filterMode === 'all' && videoIds.length !== 0)
    || (filterMode !== 'all' && videoIds.length === 0)
    || typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    return NextResponse.json({ error: 'Invalid auto-publish policy.' }, { status: 400 })
  }

  const { data, error } = await access.admin.rpc('update_youtube_auto_publish_policy', {
    p_connection_id: access.connection.id,
    p_owner_id: access.userId,
    p_expected_updated_at: expectedUpdatedAt,
    p_category_rules: rules,
    p_max_daily: maxDaily,
    p_min_confidence: minimumConfidence,
    p_delay_minutes: delay,
    p_cooldown_hours: cooldown,
    p_video_filter_mode: filterMode,
    p_video_ids: videoIds,
  })
  if (error) {
    const conflict = error.message.includes('settings_conflict')
    console.error('[YouTube automation policy] Update failed:', error.code)
    return NextResponse.json({ error: conflict ? 'Settings changed elsewhere. Reload and try again.' : 'Unable to save auto-publish settings.' }, { status: conflict ? 409 : 500 })
  }
  return NextResponse.json(responseFor((Array.isArray(data) ? data[0] : data) as SettingsRow))
}
