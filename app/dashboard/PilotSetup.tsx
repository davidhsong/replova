import Link from 'next/link'
export function Setup({ name }: { name: string }) {
  return (
    <main className="pilot" id="main-content">
      <header>
        <small>{name}</small>
        <h1>Your first location</h1>
        <p>
          Create your location, print its QR code, then test a visit before placing the Tap where
          customers can reach it.
        </p>
      </header>
      <div className="pilot-links">
        <Link className="pilot-button" href="/dashboard/tap">
          Set up your Tap
        </Link>
        <Link href="/dashboard-preview#sample-issue">Preview sample feedback</Link>
      </div>
    </main>
  )
}
