'use client'

import { useEffect, useState } from 'react'

const stages = [
  {
    number: '01',
    label: 'Foundation',
    title: 'Learn the system',
    description: 'Start with guided context, product examples, and the fundamentals behind your role.',
    outcomeLabel: 'You gain',
    outcome: 'A clear map of the work',
  },
  {
    number: '02',
    label: 'Supported work',
    title: 'Build with feedback',
    description: 'Practice on scoped tasks, ask questions early, and review decisions with a mentor.',
    outcomeLabel: 'You gain',
    outcome: 'Confidence and useful habits',
  },
  {
    number: '03',
    label: 'Evidence',
    title: 'Ship and reflect',
    description: 'Complete a small project, present what you learned, and document what you would improve.',
    outcomeLabel: 'You leave with',
    outcome: 'A project story you can explain',
  },
] as const

const READ_TIME_MS = 8500

function PauseIcon({ paused }: { paused: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      {paused ? (
        <path d="M3.5 2.4 9 6l-5.5 3.6V2.4Z" fill="currentColor" />
      ) : (
        <>
          <path d="M3.25 2.25v7.5M8.75 2.25v7.5" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
    </svg>
  )
}

export default function CareersFlow() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [manualPaused, setManualPaused] = useState(false)
  const [interactionPaused, setInteractionPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(media.matches)

    updatePreference()
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (manualPaused || interactionPaused || reducedMotion) return

    const timer = window.setTimeout(() => {
      setActiveIndex(current => (current + 1) % stages.length)
    }, READ_TIME_MS)

    return () => window.clearTimeout(timer)
  }, [activeIndex, interactionPaused, manualPaused, reducedMotion])

  const stage = stages[activeIndex]
  return (
    <div
      className="career-flow-shell"
      aria-label="Three-stage internship learning path"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setInteractionPaused(false)
      }}
    >
      <div className="career-flow-stage">
        <svg className="career-flow-route" viewBox="0 0 1000 570" preserveAspectRatio="none" aria-hidden="true">
          <path d="M300 118 L700 274 L320 448 Z" />
          <circle cx="300" cy="118" r="4" />
          <circle cx="700" cy="274" r="4" />
          <circle cx="320" cy="448" r="4" />
        </svg>

        <article className={`career-flow-card career-flow-position-${activeIndex + 1}`}>
          <div className="career-flow-card-content" key={stage.number}>
            <div className="career-flow-card-head">
              <span>{stage.number}</span>
              <small>{stage.label}</small>
            </div>
            <h3>{stage.title}</h3>
            <p>{stage.description}</p>
            <div className="career-flow-outcome">
              <span>{stage.outcomeLabel}</span>
              <strong>{stage.outcome}</strong>
            </div>
          </div>
        </article>

        <div className="career-flow-direction career-flow-direction-one" aria-hidden="true">Down and right</div>
        <div className="career-flow-direction career-flow-direction-two" aria-hidden="true">Down and left</div>
        <div className="career-flow-direction career-flow-direction-three" aria-hidden="true">Return and repeat</div>
      </div>

      <div className="career-flow-controls">
        <div className="career-flow-steps" aria-label="Select an internship stage">
          {stages.map((item, index) => (
            <button
              type="button"
              key={item.number}
              onClick={() => setActiveIndex(index)}
              aria-current={activeIndex === index ? 'step' : undefined}
            >
              <span>{item.number}</span>
              {item.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="career-flow-pause"
          onClick={() => setManualPaused(current => !current)}
          aria-label={manualPaused ? 'Resume internship path animation' : 'Pause internship path animation'}
          disabled={reducedMotion}
        >
          <PauseIcon paused={manualPaused} />
          {reducedMotion ? 'Motion off' : manualPaused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </div>
  )
}
