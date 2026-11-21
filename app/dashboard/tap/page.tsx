import QRCode from 'qrcode'
import Image from 'next/image'
import Link from 'next/link'
import { BASE_URL } from '@/lib/baseUrl'
import { checked, pilotContext } from '@/lib/pilot/access'
import CopyButton from '../CopyButton'
import { firstLocation, placardAction, attachLocation } from '../pilot-actions'

function Timezone({ value }: { value: string }) {
  return (
    <label>
      Location time zone
      <input name="timezone" required defaultValue={value} list="timezones" />
      <datalist id="timezones">
        {Intl.supportedValuesOf('timeZone').map((z) => (
          <option key={z}>{z}</option>
        ))}
      </datalist>
    </label>
  )
}
export default async function Tap({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>
}) {
  const { admin, location, workspace, legacyLocation } = await pilotContext()
  const { notice } = await searchParams
  const placards = location
    ? (checked(
        await admin
          .from('tap_placards')
          .select('id,placement')
          .eq('location_id', location.id)
          .is('revoked_at', null)
          .order('created_at', { ascending: false }),
      ) ?? [])
    : []
  return (
    <main className="pilot" id="main-content">
      <header>
        <small>{workspace.name}</small>
        <h1>Set up your Tap</h1>
        <p>
          {location
            ? location.name
            : 'Start with the location where customers will tap or scan your placard.'}
        </p>
      </header>
      {notice && <p role="alert">{notice}</p>}
      {legacyLocation ? (
        <form action={attachLocation.bind(null, legacyLocation.id)}>
          <h2>Use {legacyLocation.name}</h2>
          <p>Connect this existing location to {workspace.name} for Tap and Playbooks.</p>
          <Timezone value={legacyLocation.pilot_timezone} />
          <button>Use this location</button>
        </form>
      ) : !location ? (
        <form action={firstLocation}>
          <h2>Your first location</h2>
          <label>
            Location name
            <input
              name="name"
              defaultValue={workspace.name}
              required
              minLength={2}
              maxLength={200}
            />
          </label>
          <Timezone value="UTC" />
          <button>Create location</button>
        </form>
      ) : (
        <>
          {placards.map((p) => (
            <Placard
              key={p.id}
              id={p.id}
              name={p.placement || location.name}
              locationId={location.id}
            />
          ))}
          <form action={placardAction.bind(null, location.id)}>
            <h2>{placards.length ? 'Add another placard' : 'Create a placard'}</h2>
            <label>
              Placement (optional)
              <input name="placement" maxLength={100} placeholder="Near the exit" />
            </label>
            <Timezone value={location.pilot_timezone} />
            <button>Create Tap link</button>
          </form>
        </>
      )}
      <Link href="/dashboard/feedback?test=1">View test submissions</Link>
    </main>
  )
}
async function Placard({ id, name, locationId }: { id: string; name: string; locationId: string }) {
  const url = new URL('/t/' + id, BASE_URL)
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
    throw new Error('Set NEXT_PUBLIC_BASE_URL to the HTTPS pilot origin.')
  const qr = await QRCode.toString(url.href, {
    type: 'svg',
    width: 640,
    margin: 4,
    errorCorrectionLevel: 'M',
  })
  const src = 'data:image/svg+xml;base64,' + Buffer.from(qr).toString('base64')
  return (
    <section className="pilot-placard">
      <div>
        <h2>{name}</h2>
        <p>Program the NFC tag with this customer link. The printable QR opens the same form.</p>
        <code>{url.href}</code>
        <CopyButton text={url.href} />
        <p>
          <a href={src} download={'replova-tap-' + id + '.svg'}>
            Download printable QR
          </a>
        </p>
        <a className="pilot-button" href={url.href + '?test=1'}>
          Preview and test form
        </a>
        <details>
          <summary>Revoke this link</summary>
          <form action={placardAction.bind(null, locationId)}>
            <input type="hidden" name="action" value="revoke" />
            <input type="hidden" name="id" value={id} />
            <p>The NFC tag, printed QR and open forms will stop accepting feedback.</p>
            <button>Confirm revocation</button>
          </form>
        </details>
      </div>
      <Image unoptimized src={src} alt={'QR code for ' + name} width={160} height={160} />
    </section>
  )
}
