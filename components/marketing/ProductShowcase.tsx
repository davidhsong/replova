'use client'

import Link from 'next/link'
import { type KeyboardEvent, useRef, useState } from 'react'
import { FeatureIcon, features as FEATURES, VisitSample } from './VisitSample'
import { Eyebrow } from './Eyebrow'
import styles from './ProductShowcase.module.css'

export function ProductShowcase() {
  const [activeIndex, setActiveIndex] = useState(0)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeFeature = FEATURES[activeIndex]

  function selectFeature(index: number, moveFocus = false) {
    const nextIndex = (index + FEATURES.length) % FEATURES.length
    setActiveIndex(nextIndex)
    if (moveFocus) tabRefs.current[nextIndex]?.focus()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      selectFeature(index + 1, true)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      selectFeature(index - 1, true)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectFeature(0, true)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectFeature(FEATURES.length - 1, true)
    }
  }

  return (
    <section id="intelligence" className={styles.section} aria-labelledby="product-showcase-title">
      <div className={styles.inner}>
        <header className={styles.heading}>
          <Eyebrow>Explore Replova Tap</Eyebrow>
          <h2 id="product-showcase-title">Put customer feedback to work.</h2>
        </header>

        <div className={styles.frame}>
          <div className={styles.tabRail}>
            <div className={styles.tabScroller}>
              <div className={styles.tabList} role="tablist" aria-label="Replova product features">
                <span className={styles.activeIndicator} data-index={activeIndex} aria-hidden="true" />
                {FEATURES.map((feature, index) => (
                  <button
                    key={feature.id}
                    ref={element => { tabRefs.current[index] = element }}
                    type="button"
                    role="tab"
                    id={`showcase-tab-${feature.id}`}
                    aria-controls="product-showcase-panel"
                    aria-selected={activeIndex === index}
                    tabIndex={activeIndex === index ? 0 : -1}
                    onClick={() => selectFeature(index)}
                    onKeyDown={event => handleTabKeyDown(event, index)}
                  >
                    <FeatureIcon id={feature.id} />
                    <span>{feature.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            id="product-showcase-panel"
            className={styles.panel}
            role="tabpanel"
            aria-labelledby={`showcase-tab-${activeFeature.id}`}
          >
            <div key={`copy-${activeFeature.id}`} className={styles.copy}>
              <div>
                <h3>{activeFeature.headline}</h3>
                <p>{activeFeature.description}</p>
              </div>
              <Link
                href="/demo"
                className={styles.cta}
                aria-label={`Request a demo of ${activeFeature.label}`}
              >
                Request a demo
              </Link>
            </div>

            <div className={styles.visualStage} data-feature={activeFeature.id}>
              <VisitSample feature={activeFeature.id} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
