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
        <small>Customer review</small>
        <p>&ldquo;They explained the options clearly and finished ahead of schedule.&rdquo;</p>
      </div>

      <div className="promise-draft-stage">
        <div className="promise-connector">
          <svg viewBox="0 0 26 100" preserveAspectRatio="none">
            <path pathLength="1" d="M 0 0 V 100 H 26" />
          </svg>
        </div>

        <div className="promise-node promise-replova-draft">
          <small>Replova draft</small>
          <p>&ldquo;Thank you for trusting our team. We&apos;re glad the options felt clear and the early finish made your day easier.&rdquo;</p>
        </div>
      </div>
    </div>
  )
}
