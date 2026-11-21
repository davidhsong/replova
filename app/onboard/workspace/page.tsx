import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ReplovaLogo } from '@/components/brand/ReplovaLogo'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getAccountForAuthUser } from '@/lib/accountAccess'
import WorkspaceSetupForm from './WorkspaceSetupForm'

export default async function WorkspaceOnboardingPage() {
  const supabase = createClient(await cookies())
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/signin?next=${encodeURIComponent('/onboard/workspace')}`)

  const admin = getSupabaseAdmin()
  const account = await getAccountForAuthUser(admin, user)
  if (account?.auth_user_id === user.id) {
    const { data: workspace } = await admin
      .from('business_workspaces')
      .select('id')
      .eq('account_id', account.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (workspace) redirect('/dashboard')
  }

  return (
    <main id="main-content" className="workspace-onboarding-shell">
      <header className="account-onboarding-header">
        <Link href="/" aria-label="Replova home">
          <ReplovaLogo variant="primary" surface="light" height={25} decorative eager />
        </Link>
        <p>{user.email}</p>
      </header>
      <div className="workspace-onboarding-grid">
        <section className="workspace-onboarding-copy" aria-labelledby="workspace-title">
          <p className="t-eyebrow">Email verified</p>
          <h1 id="workspace-title">Name your business workspace</h1>
          <p>
            Use the business name you recognize across your locations. You’ll choose a location when you review its feedback or open a Playbook.
          </p>
          <div className="workspace-privacy-note">
            Only your authenticated account can create or access this workspace. Google Business
            Profile and YouTube remain disconnected until you choose to authorize them.
          </div>
        </section>
        <section className="account-onboarding-form-panel" aria-label="Create business workspace">
          {user.email_confirmed_at ? (
            <>
              <div className="account-onboarding-form-heading">
                <p className="t-eyebrow">Step 2 of 2</p>
                <h2>Business workspace</h2>
                <p>No address or public listing is required.</p>
              </div>
              <WorkspaceSetupForm />
            </>
          ) : (
            <div className="account-onboarding-success">
              <p className="t-eyebrow">Verification required</p>
              <h2>Open your email link first</h2>
              <p>This session is not verified. Request a fresh link and try again.</p>
              <Link href="/onboard" className="btn btn-primary">Return to signup</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
