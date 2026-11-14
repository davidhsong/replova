'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange)
  window.addEventListener('offline', onStoreChange)
  return () => {
    window.removeEventListener('online', onStoreChange)
    window.removeEventListener('offline', onStoreChange)
  }
}

function getSnapshot() {
  return !navigator.onLine
}

function getServerSnapshot() {
  return false
}

export default function OfflineStatus() {
  const offline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (!offline) return null

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="offline-dot" aria-hidden="true" />
      You&apos;re offline. Syncing, publishing, and account changes need a connection.
    </div>
  )
}
