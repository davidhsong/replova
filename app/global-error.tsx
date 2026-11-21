'use client'
import './globals.css'
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en" className="replova-type">
      <body>
        <main id="main-content" style={{ maxWidth: 600, margin: '15vh auto', padding: 24 }}>
          <h1>We couldn’t open this page</h1>
          <p style={{ margin: '12px 0 24px' }}>Try loading it again.</p>
          <button className="btn btn-primary" onClick={retry}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
