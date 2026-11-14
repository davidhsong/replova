import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

type ConnectionRow = { id: string }
type SettingsRow = {
  automation_enabled: boolean
  auto_publish_enabled: boolean
  max_drafts_per_run: number
}

async function authenticatedConnection() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = getSupabaseAdmin()
  const { data: connection, error } = await admin
    .from('youtube_connections')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle<ConnectionRow>()

  if (error) {
    console.error('[YouTube automation settings] Connection lookup failed:', error.code)
    return { error: NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 }) }
  }
  if (!connection) {
    return { error: NextResponse.json({ error: 'Connect YouTube before changing automation settings.' }, { status: 404 }) }
  }
  return { admin, connection }
}

export async function GET() {
  const auth = await authenticatedConnection()
  if ('error' in auth) return auth.error

  const { data, error } = await auth.admin
    .from('youtube_automation_settings')
    .select('automation_enabled, auto_publish_enabled, max_drafts_per_run')
    .eq('connection_id', auth.connection.id)
    .maybeSingle<SettingsRow>()

  if (error) {
    console.error('[YouTube automation settings] Settings lookup failed:', error.code)
    return NextResponse.json({ error: 'Unable to load YouTube automation settings.' }, { status: 500 })
  }

  return NextResponse.json({
    automaticDraftingEnabled: data?.automation_enabled ?? false,
    autoPublishEnabled: data?.auto_publish_enabled ?? false,
    maxDraftsPerRun: data?.max_drafts_per_run ?? 20,
  })
}

export async function PATCH(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }

  const auth = await authenticatedConnection()
  if ('error' in auth) return auth.error

  let body: { automaticDraftingEnabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  if (typeof body.automaticDraftingEnabled !== 'boolean') {
    return NextResponse.json({ error: 'Automatic drafting must be enabled or disabled.' }, { status: 400 })
  }

  const { error } = await auth.admin
    .from('youtube_automation_settings')
    .upsert({
      connection_id: auth.connection.id,
      automation_enabled: body.automaticDraftingEnabled,
    }, { onConflict: 'connection_id' })

  if (error) {
    console.error('[YouTube automation settings] Settings update failed:', error.code)
    return NextResponse.json({ error: 'Unable to save automatic drafting.' }, { status: 500 })
  }

  return NextResponse.json({ automaticDraftingEnabled: body.automaticDraftingEnabled })
}
