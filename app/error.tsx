'use client'

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <a href="/" className="text-lg font-semibold tracking-tight text-zinc-900">Replova</a>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-7xl font-bold text-zinc-100 mb-4">500</p>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Something went wrong</h1>
          <p className="text-zinc-500 text-sm mb-8">An unexpected error occurred. Please try again.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="rounded-full bg-zinc-900 text-white text-sm font-medium px-6 py-2.5 hover:bg-zinc-700 transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-full border border-zinc-200 text-zinc-700 text-sm font-medium px-6 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
