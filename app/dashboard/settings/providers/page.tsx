import Link from 'next/link'
import { pilotContext } from '@/lib/pilot/access'

export default async function ProviderSettings() {
  const { location } = await pilotContext()
  const selected = Boolean(location && process.env.PILOT_PROVIDER_LOCATION_ID === location.id)
  const channel = Boolean(
    process.env.PILOT_PROVIDER_URL?.startsWith('https://') && process.env.PILOT_PROVIDER_TOKEN,
  )
  return (
    <main id="main-content" className="pilot">
      <header>
        <small>Settings / {location?.name ?? 'Workspace'}</small>
        <h1>Provider integrations</h1>
        <p>
          Each service run needs an owner to set the scope, budget and service window. Replova
          checks channel capabilities before sending a request.
        </p>
      </header>
      <section>
        <h2>Local research</h2>
        <p>
          {process.env.GOOGLE_PLACES_API_KEY
            ? 'Google Places is configured for local search.'
            : channel
              ? 'The provider gateway must support discovery.'
              : 'Configure Google Places or a gateway with local discovery.'}
        </p>
      </section>
      <section>
        <h2>Quotes and booking</h2>
        <dl>
          <dt>Gateway credentials</dt>
          <dd>{channel ? 'Configured' : 'Missing HTTPS gateway URL or token'}</dd>
          <dt>Live provider actions</dt>
          <dd>{process.env.PILOT_PROVIDER_LIVE === 'true' ? 'Enabled' : 'Disabled'}</dd>
          <dt>Pilot location</dt>
          <dd>
            {selected
              ? 'This location is selected'
              : 'This location has not been selected for live outreach'}
          </dd>
        </dl>
        <p>
          Your deployment administrator configures the channel. Test Playbooks always use simulated
          providers.
        </p>
      </section>
      <Link href="/dashboard/playbooks">Open Playbooks</Link>
    </main>
  )
}
