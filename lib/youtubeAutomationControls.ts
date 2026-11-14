import 'server-only'

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from './supabase'
import { createClient } from '@/utils/supabase/server'

const mutationWindows = new Map<string, { startedAt: number; count: number }>()
const MUTATION_WINDOW_MS = 10 * 60_000
const MUTATION_LIMIT = 20

export function isSameOrigin(request: NextRequest): boolean {
  return request.headers.get('origin') === request.nextUrl.origin
}

export function allowYouTubeControlMutation(userId: string): boolean {
  const now = Date.now()
  const existing = mutationWindows.get(userId)
  if (!existing || now - existing.startedAt >= MUTATION_WINDOW_MS) {
    mutationWindows.set(userId, { startedAt: now, count: 1 })
    return true
  }
  if (existing.count >= MUTATION_LIMIT) return false
  existing.count += 1
  return true
}

export async function getYouTubeAutomationAccess() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false as const, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = getSupabaseAdmin()
  const { data: connection, error } = await admin
    .from('youtube_connections')
    .select('id, user_id, channel_id')
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; user_id: string; channel_id: string }>()
  if (error) {
    console.error('[YouTube automation controls] Connection lookup failed:', error.code)
    return { ok: false as const, error: NextResponse.json({ error: 'Unable to load the YouTube connection.' }, { status: 500 }) }
  }
  if (!connection) {
    return { ok: false as const, error: NextResponse.json({ error: 'Connect YouTube before configuring automation.' }, { status: 404 }) }
  }

  return {
    ok: true as const,
    admin,
    userId: user.id,
    connection: { id: connection.id, channelId: connection.channel_id },
  }
}

export function mutationGuard(request: NextRequest, userId: string): NextResponse | null {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  if (!allowYouTubeControlMutation(userId)) {
    return NextResponse.json({ error: 'Too many settings changes. Try again shortly.' }, { status: 429 })
  }
  return null
}
