export const careerRoles = [
  {
    key: 'product-engineering',
    slug: 'product-engineering-intern',
    title: 'Product & Engineering Intern',
    summary: 'Learn how a production SaaS product is designed, built, tested, and shipped.',
    role: 'You will learn how Replova moves from a customer problem to a reliable product change. With guidance, you will explore the codebase, reproduce issues, improve documentation, test key workflows, and take on a small project sized around your current skill level.',
    learn: [
      'Next.js and TypeScript product development',
      'API, database, and third-party integration fundamentals',
      'Accessibility, QA, debugging, and release verification',
      'How customer feedback becomes a product decision',
    ],
    projects: [
      'Test onboarding, review, billing, and mobile workflows with a mentor',
      'Improve documentation and small product surfaces',
      'Prototype and ship a scoped feature after guided practice',
      'Present what you learned and what you would improve next',
    ],
    requirements: [
      'Interest in learning how software products are built; prior coding experience is not required',
      'Comfort working through unfamiliar problems and asking clear questions',
      'Care with details when testing, documenting, or reviewing a product change',
      'Access to a computer and dependable internet for remote collaboration',
    ],
    applicationQuestion: 'Describe something digital you would improve and explain why.',
  },
  {
    key: 'growth-customer-experience',
    slug: 'growth-customer-experience-intern',
    title: 'Growth & Customer Experience Intern',
    summary: 'Learn how an early-stage product finds the right users and turns their feedback into better experiences.',
    role: 'You will help Replova understand what local business owners need before, during, and after onboarding. With guidance, you will support customer research, organize feedback themes, improve educational content, and evaluate small outreach or onboarding experiments without individual sales quotas.',
    learn: [
      'Customer interviews and ethical research',
      'Clear product writing and educational content',
      'Experiment design and basic funnel analysis',
      'How support themes inform product and positioning',
    ],
    projects: [
      'Help prepare interview guides and organize anonymized themes',
      'Draft resource content and onboarding improvements',
      'Review outreach experiments without individual sales quotas',
      'Present a customer insight brief with recommended next steps',
    ],
    requirements: [
      'Interest in customers, communication, or early-stage businesses; prior marketing experience is not required',
      'Clear and respectful written communication',
      'Willingness to listen carefully and separate evidence from assumptions',
      'Access to a computer and dependable internet for remote collaboration',
    ],
    applicationQuestion: 'Tell us about a product experience that made you feel understood as a customer.',
  },
  {
    key: 'data-review-intelligence',
    slug: 'data-review-intelligence-intern',
    title: 'Data & Review Intelligence Intern',
    summary: 'Learn how customer review data becomes trustworthy themes, scores, reports, and product decisions.',
    role: 'You will learn how Replova turns unstructured customer reviews into useful business intelligence. With guidance, you will review anonymized examples, test AI-generated classifications, spot inconsistencies, help improve reporting language, and document what makes an insight genuinely useful to a business owner.',
    learn: [
      'How qualitative feedback is organized into useful themes',
      'Basic data quality, sampling, and AI-output evaluation',
      'Clear reporting for non-technical business owners',
      'How privacy and responsible AI affect product decisions',
    ],
    projects: [
      'Evaluate anonymized sentiment labels and topic groupings against a clear rubric',
      'Identify confusing or unsupported claims in sample insight reports',
      'Help document a repeatable quality-check process',
      'Present a short analysis of a review theme and the evidence behind it',
    ],
    requirements: [
      'Interest in data, research, customer feedback, or responsible AI; prior analytics experience is not required',
      'Patience for careful review and consistent labeling',
      'Ability to explain how you reached a conclusion using specific evidence',
      'Access to a computer and dependable internet for remote collaboration',
    ],
    applicationQuestion: 'What makes a customer-feedback insight trustworthy and useful?',
  },
] as const

export type CareerRole = (typeof careerRoles)[number]

export function getCareerRoleBySlug(slug: string): CareerRole | undefined {
  return careerRoles.find(role => role.slug === slug)
}

export function getCareerRoleByKey(key: string): CareerRole | undefined {
  return careerRoles.find(role => role.key === key)
}

