'use client'

import { useId, useState } from 'react'
import styles from './HomeFaq.module.css'

export const HOME_FAQS = [
  {
    question: 'Who is Replova built for?',
    answer: 'Replova is built for local service businesses that want a clearer review and customer-feedback workflow. You can create an account and workspace without connecting Google or adding a physical location.',
  },
  {
    question: 'Does Replova post replies automatically?',
    answer: 'Replova prepares professional, warm, and brief drafts for your review. A person approves and confirms each public reply; unattended publishing remains disabled.',
  },
  {
    question: 'How does the AI learn our voice?',
    answer: 'Every plan includes three practical reply styles. Agency customers can add a custom reply persona for more specific brand guidance, while every draft still stays subject to approval.',
  },
  {
    question: 'What happens when a low rating arrives?',
    answer: 'For an authorized review source, Replova can flag the review as urgent and email the owner with the review and a suggested response based on the configured threshold.',
  },
  {
    question: 'Can I cancel or change plans?',
    answer: 'Yes. Subscription changes are handled through the secure Stripe billing portal. Existing subscriptions keep their current Stripe price unless the customer explicitly changes plans.',
  },
] as const

export function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const componentId = useId().replaceAll(':', '')

  return (
    <section id="faq" className={styles.section} aria-labelledby={`${componentId}-title`}>
      <div className={styles.inner}>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>FAQ</div>
          <h2 id={`${componentId}-title`}>A few things worth knowing.</h2>
          <p>Plain answers about control, access, and billing before you create an account.</p>
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
