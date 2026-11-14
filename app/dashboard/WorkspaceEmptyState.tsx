import Link from 'next/link'
import AutoDismissBanner from './AutoDismissBanner'

export default function WorkspaceEmptyState({
  workspaceName,
  welcome,
}: {
  workspaceName: string
  welcome: boolean
}) {
  return (
    <>
      <div className="page-header workspace-empty-header">
        <div>
          <div className="t-eyebrow">
            <span className="c-t3">Workspace</span>
            {' / '}
            <span>Reviews</span>
          </div>
          <h1 className="t-h1">{workspaceName}</h1>
          <p className="t-sm c-t3">No locations connected</p>
        </div>
        <span className="workspace-empty-status"><span aria-hidden="true" />Setup ready</span>
      </div>

      <div className="page-body workspace-empty-body">
        {welcome && (
          <AutoDismissBanner className="banner banner-pos fade-up" delay={5000}>
            Your account and workspace are ready. Google connection is optional.
          </AutoDismissBanner>
        )}

        <section className="workspace-empty-hero" aria-labelledby="workspace-empty-title">
          <div className="workspace-empty-copy">
            <p className="t-eyebrow">Review center</p>
            <h2 id="workspace-empty-title">Bring your Google reviews into one place.</h2>
            <p>
              Your workspace is active without a public listing. When you are ready, add a
              location or continue directly into the guided Google Business Profile setup.
            </p>
            <div className="workspace-empty-actions">
              <Link href="/onboard?add=true&intent=google" className="btn btn-primary">
                Connect Google Business Profile
              </Link>
              <Link href="/onboard?add=true" className="btn btn-ghost">
                Add location
              </Link>
            </div>
            <small>
              Both steps are optional. Replova will not publish, sync, or create a Google profile without your authorization.
            </small>
          </div>

          <ol className="workspace-empty-checklist" aria-label="Workspace setup progress">
            <li data-complete="true">
              <span>01</span>
              <div><strong>Account verified</strong><small>Your secure sign-in is active.</small></div>
            </li>
            <li data-complete="true">
              <span>02</span>
              <div><strong>Workspace created</strong><small>{workspaceName} is ready.</small></div>
            </li>
            <li>
              <span>03</span>
              <div><strong>Google connection</strong><small>Optional until you want to sync reviews.</small></div>
            </li>
          </ol>
        </section>

        <section className="workspace-empty-footnote">
          <div>
            <strong>Not ready to connect Google?</strong>
            <p>You can review billing, account settings, or use the developer YouTube integration independently.</p>
          </div>
          <Link href="/dashboard/settings" className="btn btn-quiet">Open settings</Link>
        </section>
      </div>
    </>
  )
}
