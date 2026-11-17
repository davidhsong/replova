'use client'

import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
import { type KeyboardEvent, useRef, useState } from 'react'
import {
  IconAlert,
  IconArrowUp,
  IconBook,
  IconMessage,
} from '@/components/icons'
import reviewIntelligenceImage from '@/public/product-showcase/review-intelligence.png'
import reviewIntelligenceFocusImage from '@/public/product-showcase/review-intelligence-focus.png'
import aiReplyDraftsImage from '@/public/product-showcase/ai-reply-drafts.png'
import aiReplyDraftsFocusImage from '@/public/product-showcase/ai-reply-drafts-focus.png'
import feedbackAnalyticsImage from '@/public/product-showcase/feedback-analytics.png'
import feedbackAnalyticsFocusImage from '@/public/product-showcase/feedback-analytics-focus.png'
import businessPlaybooksImage from '@/public/product-showcase/business-playbooks.png'
import businessPlaybooksFocusImage from '@/public/product-showcase/business-playbooks-focus.png'
import styles from './ProductShowcase.module.css'

type FeatureId =
  | 'review-intelligence'
  | 'ai-reply-drafts'
  | 'feedback-analytics'
  | 'business-playbooks'

type Feature = {
  id: FeatureId
  label: string
  headline: string
  headlineLines: readonly string[]
  description: string
  image: StaticImageData
  focusImage: StaticImageData
  imageAlt: string
  Icon: typeof IconAlert
}

const FEATURES: Feature[] = [
  {
    id: 'review-intelligence',
    label: 'Review intelligence',
    headline: 'Find the signal in every review.',
    headlineLines: ['Find the signal', 'in every review.'],
    description: 'Understand what customers love, uncover recurring complaints, and turn reviews into clearer business decisions.',
    image: reviewIntelligenceImage,
    focusImage: reviewIntelligenceFocusImage,
    imageAlt: 'Synthetic Replova Review Center showing reputation metrics, a review queue, reply controls, and queue health.',
    Icon: IconAlert,
  },
  {
    id: 'ai-reply-drafts',
    label: 'AI reply drafts',
    headline: 'Thoughtful replies, in your voice.',
    headlineLines: ['Thoughtful replies,', 'in your voice.'],
    description: 'Generate personalized responses, adjust the tone, and review every draft before responding.',
    image: aiReplyDraftsImage,
    focusImage: aiReplyDraftsFocusImage,
    imageAlt: 'Synthetic Replova Review Center showing a selected customer review and a warm AI reply draft awaiting owner review.',
    Icon: IconMessage,
  },
  {
    id: 'feedback-analytics',
    label: 'Feedback analytics',
    headline: "See what's improving. Spot what's not.",
    headlineLines: ["See what's improving.", "Spot what's not."],
    description: 'Turn customer feedback into meaningful trends, track recurring issues, and understand where your business can improve.',
    image: feedbackAnalyticsImage,
    focusImage: feedbackAnalyticsFocusImage,
    imageAlt: 'Synthetic Replova feedback insights dashboard showing a six-week trend, recurring themes, and improvement priorities.',
    Icon: IconArrowUp,
  },
  {
    id: 'business-playbooks',
    label: 'Business Playbooks',
    headline: 'Turn feedback into a better way to work.',
    headlineLines: ['Turn feedback into', 'a better way to work.'],
    description: 'Build better procedures, review suggested improvements, assign tasks, and track changes in one organized Playbook.',
    image: businessPlaybooksImage,
    focusImage: businessPlaybooksFocusImage,
    imageAlt: 'Synthetic Replova Business Playbook showing the procedure library and the Service status updates document reader.',
    Icon: IconBook,
  },
]

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
                <h3 aria-label={activeFeature.headline}>
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

            <div className={styles.visualStage} aria-live="polite">
              {FEATURES.map((feature, index) => (
                <div
                  key={feature.id}
                  className={styles.visualLayer}
                  data-active={activeIndex === index}
                  data-visual={feature.id}
                  aria-hidden={activeIndex !== index}
                >
                  <div className={styles.contextWindow}>
                    <Image
                      src={feature.image}
                      alt=""
                      fill
                      sizes="(max-width: 820px) 160vw, 72vw"
                      quality={92}
                    />
                  </div>
                  <div className={styles.focusWindow}>
                    <div className={styles.focusImage}>
                      <Image
                        src={feature.focusImage}
                        alt={feature.imageAlt}
                        fill
                        sizes="(max-width: 820px) 150vw, 64vw"
                        quality={92}
                      />
                    </div>
                  </div>
                  <span className={styles.sampleLabel}>Synthetic workspace</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
