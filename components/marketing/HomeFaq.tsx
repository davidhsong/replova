'use client'

import { useId, useState } from 'react'
import styles from './HomeFaq.module.css'

export const HOME_FAQS = [
  {
    question: 'Does the customer need an app or account?',
    answer: 'No. Tapping the NFC tag or scanning the QR opens the feedback form in the phone’s browser.',
  },
  {
    question: 'Can customers leave just a rating?',
    answer: 'Yes. Customers choose 1 to 5 and can send their rating with the comment box empty. That visit still counts in the inbox.',
  },
  {
    question: 'Who can see the feedback?',
    answer: 'The signed-in business owner can read submissions in the location’s Feedback inbox. Submitting the form does not publish a Google review.',
  },
  {
    question: 'How do locations stay separate?',
    answer: 'Each placard sends feedback to one location. If you manage several, select a location to see its inbox, issue counts, and Playbooks.',
  },
  {
    question: 'What happens to written comments?',
    answer: 'The owner can read the original comment and rating. When analysis is enabled for the location, Replova can group recurring issues and show supporting excerpts. On eligible plans, the inbox also shows sentiment for the written words.',
  },
  {
    question: 'Is a Google Business Profile required for Tap?',
    answer: 'No. An eligible owner can create a first location from Tap with its name and time zone. A Google Business Profile is optional for separate Google review tools.',
  },
] as const

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const componentId = useId().replaceAll(':', '')

  return (
    <section id="faq" className={styles.section} aria-labelledby={`${componentId}-title`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>FAQ</div>
          <h2 id={`${componentId}-title`}>A few things worth knowing.</h2>
          <p>What customers send and what the owner sees.</p>
        </div>

        <div className={styles.list}>
          {HOME_FAQS.map((item, index) => {
            const isOpen = openIndex === index
            const buttonId = `${componentId}-question-${index}`
            const panelId = `${componentId}-answer-${index}`

            return (
              <div className={`${styles.item} ${isOpen ? styles.open : ''}`} key={item.question}>
                <button
                  id={buttonId}
                  className={styles.question}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(current => current === index ? null : index)}
                >
                  <span>{item.question}</span>
                  <svg aria-hidden="true" viewBox="0 0 18 18">
                    <path d="M4 7l5 5 5-5" />
                  </svg>
                </button>
                <div className={styles.answerStage}>
                  <div className={styles.answerClip}>
                    <i className={styles.connector} aria-hidden="true" />
                    <div
                      id={panelId}
                      className={styles.answer}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!isOpen}
                      inert={!isOpen ? true : undefined}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
