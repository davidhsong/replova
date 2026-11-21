'use client'

import { useEffect, useRef } from 'react'

export function PromiseWorkflowVisual() {
  const visualRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const visual = visualRef.current
    if (!visual) return

    if (!('IntersectionObserver' in window)) {
      visual.dataset.promiseVisible = 'true'
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      visual.dataset.promiseVisible = String(entry.isIntersecting && entry.intersectionRatio >= 0.35)
    }, { threshold: [0, 0.35] })

    observer.observe(visual)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={visualRef}
      className="promise-visual"
      data-promise-visible="false"
      aria-hidden="true"
    >
      <div className="promise-node promise-customer-review">
        <small>Sample visit · Market Lane</small>
        <p>&ldquo;The tea was great, but I couldn’t tell which shelf was for pickup.&rdquo;</p>
      </div>

      <div className="promise-draft-stage">
        <div className="promise-connector">
          <svg viewBox="0 0 26 100" preserveAspectRatio="none">
            <path pathLength="1" d="M 0 0 V 100 H 26" />
          </svg>
        </div>

        <div className="promise-node promise-replova-draft">
          <small>Owner’s Playbook · Pickup shelves</small>
          <p>Label the shelves “Pickup” and “Order here” before the next shift.</p>
        </div>
      </div>
    </div>
  )
}
