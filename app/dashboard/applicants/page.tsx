import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ApplicantsClient from './ApplicantsClient'
import type { CareerApplication } from '@/lib/careerApplications'
import { isCareerAdminEmail } from '@/lib/careersAdmin'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/utils/supabase/server'

export default async function ApplicantsPage() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')
  if (!await isCareerAdminEmail(user.email)) redirect('/dashboard')

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('career_applications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[dashboard/applicants] load failed:', error.code)
    throw new Error('Unable to load career applications.')
  }

  return (
    <>
      <div className="page-header">
        <div className="t-eyebrow applicant-breadcrumb">
          <span>Workspace</span>
          <span aria-hidden="true">›</span>
          <span>Applicants</span>
        </div>
        <h1 className="t-h1">Applicant pipeline</h1>
        <p className="t-sm c-t3">Review every website application, record decisions, and keep the hiring process in one place.</p>
      </div>
      <div className="page-body applicant-page-body">
        <ApplicantsClient initialApplications={(data ?? []) as CareerApplication[]} />
      </div>
    </>
  )
}
