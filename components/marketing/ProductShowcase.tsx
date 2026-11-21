'use client'

import Image from 'next/image'
import Link from 'next/link'
import { type KeyboardEvent, useRef, useState } from 'react'
import {
  IconAlert,
  IconArrowUp,
  IconBook,
  IconMessage,
} from '@/components/icons'
import styles from './ProductShowcase.module.css'

const FEATURES = [
  {
    id: 'tap', width: 992, height: 1372, mobileWidth: 650, mobileHeight: 1318,
    label: 'Replova Tap', Icon: IconMessage,
    headlineLines: ['How was', 'your visit?'],
    description: 'At Market Lane, a tap or scan opens one short form. Choose a rating, add a comment if you like, and send it straight to the shop.',
    imageAlt: 'Sample Market Lane customer form with a 4 out of 5 rating and an optional comment about the pickup shelves.',
  },
  {
    id: 'inbox', width: 1070, height: 668, mobileWidth: 648, mobileHeight: 820,
    label: 'Feedback inbox', Icon: IconAlert,
    headlineLines: ['Read the visit', 'in context.'],
    description: 'See the original 4 out of 5 beside the customer’s words. They liked the tea and had trouble finding their order. Their comment sentiment is mixed.',
    imageAlt: 'Sample Market Lane inbox showing the original rating, comment, mixed sentiment, and Pickup shelves theme.',
  },
  {
    id: 'issues', width: 1130, height: 900, mobileWidth: 708, mobileHeight: 1120,
    label: 'Recurring issues', Icon: IconArrowUp,
    headlineLines: ['Two visits,', 'one issue.'],
    description: 'Two of six submissions mention the pickup shelves. Open that issue to read the comments behind the count.',
    imageAlt: 'Sample Pickup shelves issue with two of six submissions and the two customers’ supporting excerpts.',
  },
  {
    id: 'playbook', width: 1070, height: 840, mobileWidth: 648, mobileHeight: 1100,
    label: 'Playbooks', Icon: IconBook,
    headlineLines: ['Give the fix', 'a next step.'],
    description: 'The owner logs an internal task to label the shelves before the next shift. The Playbook keeps the notes and tracks the task through completion.',
    imageAlt: 'Sample Playbook with saved shelf-labeling instructions and an internal corrective task.',
  },
] as const

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
          <span className={styles.eyebrow}>Explore the platform</span>
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
                    <feature.Icon s={17} sw={1.55} />
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
                <h3 aria-label={activeFeature.headlineLines.join(' ')}>
                  {activeFeature.headlineLines.map(line => <span key={line}>{line}</span>)}
                </h3>
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
              <div className={styles.screenshot} key={activeFeature.id}>
                <picture>
                  <source media="(max-width: 620px)" width={activeFeature.mobileWidth} height={activeFeature.mobileHeight} srcSet={'/tap-showcase/' + activeFeature.id + '-mobile.png'} />
                  <Image src={'/tap-showcase/' + activeFeature.id + '.png'} alt={activeFeature.imageAlt}
                    width={activeFeature.width} height={activeFeature.height} sizes="(max-width: 620px) 90vw, 550px" />
                </picture>
              </div>
              <span className={styles.sampleLabel}>Sample data · Market Lane</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
