import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { isCareerApplicationStatus } from '@/lib/careerApplications'
import { isCareerAdminEmail } from '@/lib/careersAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

async function getAuthorizedReviewer() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  return user && await isCareerAdminEmail(user.email) ? user : null
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getAuthorizedReviewer()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  let body: { status?: unknown; reviewerNotes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const update: Record<string, string> = {
    reviewed_by: user.email!,
    updated_at: new Date().toISOString(),
  }
  if (body.status !== undefined) {
    if (!isCareerApplicationStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid application status.' }, { status: 400 })
    }
    update.status = body.status
  }
  if (body.reviewerNotes !== undefined) {
    if (typeof body.reviewerNotes !== 'string' || body.reviewerNotes.length > 10000) {
      return NextResponse.json({ error: 'Notes must be 10,000 characters or fewer.' }, { status: 400 })
    }
    update.reviewer_notes = body.reviewerNotes.trim()
  }
  if (body.status === undefined && body.reviewerNotes === undefined) {
    return NextResponse.json({ error: 'No changes supplied.' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('career_applications')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('[careers/applications] update failed:', error.code)
    return NextResponse.json({ error: 'Unable to update this application.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Application not found.' }, { status: 404 })
  return NextResponse.json(data)
}
