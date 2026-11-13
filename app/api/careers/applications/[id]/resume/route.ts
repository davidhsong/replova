import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isCareerAdminEmail } from '@/lib/careersAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

function attachmentFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120) || 'resume'
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !await isCareerAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()
  const { data: application, error: applicationError } = await admin
    .from('career_applications')
    .select('resume_path, resume_filename, resume_content_type')
    .eq('id', id)
    .maybeSingle()

  if (applicationError) {
    console.error('[careers/resume] lookup failed:', applicationError.code)
    return NextResponse.json({ error: 'Unable to load the resume.' }, { status: 500 })
  }
  if (!application?.resume_path) {
    return NextResponse.json({ error: 'Resume not found.' }, { status: 404 })
  }

  const { data, error } = await admin.storage.from('career-resumes').download(application.resume_path)
  if (error || !data) {
    console.error('[careers/resume] download failed:', error?.message)
    return NextResponse.json({ error: 'Unable to download the resume.' }, { status: 500 })
  }

  return new Response(data, {
    headers: {
      'Content-Type': application.resume_content_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${attachmentFilename(application.resume_filename || 'resume')}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
