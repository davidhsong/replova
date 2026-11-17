export type IndustrySolution = {
  slug: string
  name: string
  navName: string
  eyebrow: string
  headline: string
  lede: string
  businesses: readonly string[]
  moments: readonly { title: string; detail: string }[]
  signals: readonly string[]
  workflow: readonly { title: string; detail: string }[]
  example: {
    review: string
    response: string
    insight: string
  }
}

export const industrySolutions: readonly IndustrySolution[] = [
  {
    slug: 'healthcare-wellness',
    name: 'Healthcare & wellness',
    navName: 'Healthcare & wellness',
    eyebrow: 'For care-centered businesses',
    headline: 'Protect trust at every point in the patient experience.',
    lede: 'Replova helps healthcare and wellness teams respond with care while spotting recurring friction in scheduling, communication, comfort, and follow-up.',
    businesses: ['Dental practices', 'Med spas', 'Physical therapy', 'Wellness studios'],
    moments: [
      { title: 'Before the visit', detail: 'Appointment access, reminders, directions, and expectations.' },
      { title: 'During the experience', detail: 'Wait time, staff communication, comfort, and clarity.' },
      { title: 'Aftercare', detail: 'Follow-up instructions, responsiveness, and continuity.' },
    ],
    signals: ['Scheduling friction', 'Staff bedside manner', 'Wait-time patterns', 'Follow-up clarity'],
    workflow: [
      { title: 'Review with context', detail: 'See the rating, sentiment, and likely experience theme together.' },
      { title: 'Respond thoughtfully', detail: 'Choose a professional, warm, or brief draft without discussing private details.' },
      { title: 'Improve the handoff', detail: 'Turn repeated communication gaps into a specific operational change.' },
    ],
    example: {
      review: 'The team was kind, but I was not sure what to expect after my appointment and had trouble reaching someone.',
      response: 'Thank you for sharing this. We are glad the team made you feel welcome, and we are sorry our follow-up guidance was not clear. We are reviewing that handoff with our team.',
      insight: 'Positive care experience; follow-up communication is the recoverable gap.',
    },
  },
  {
    slug: 'home-services',
    name: 'Home services',
    navName: 'Home services',
    eyebrow: 'For teams working in the home',
    headline: 'Turn service-call feedback into a more dependable operation.',
    lede: 'Track what homeowners say about arrival windows, estimates, workmanship, cleanup, and follow-through. Then give every review a clear response.',
    businesses: ['HVAC and plumbing', 'Electrical services', 'Roofing and restoration', 'Cleaning and landscaping'],
    moments: [
      { title: 'Booking', detail: 'Speed to answer, scheduling clarity, and arrival expectations.' },
      { title: 'On site', detail: 'Professionalism, explanation, workmanship, and respect for the home.' },
      { title: 'Closeout', detail: 'Cleanup, invoicing, warranty guidance, and promised follow-up.' },
    ],
    signals: ['Arrival-time accuracy', 'Estimate clarity', 'Technician communication', 'Cleanup and follow-through'],
    workflow: [
      { title: 'Catch the issue early', detail: 'Surface low ratings and overdue replies before they disappear into an inbox.' },
      { title: 'Reply in your voice', detail: 'Acknowledge the exact service moment without relying on a generic apology.' },
      { title: 'Find repeatable fixes', detail: 'See whether the same branch, crew, or handoff keeps appearing.' },
    ],
    example: {
      review: 'The repair itself was solid, but the arrival window changed twice and nobody updated us.',
      response: 'We are glad the repair met the mark, but you should not have had to chase us for an arrival update. We are tightening that communication step with our dispatch team.',
      insight: 'Work quality is strong; dispatch communication is reducing overall trust.',
    },
  },
  {
    slug: 'automotive',
    name: 'Automotive',
    navName: 'Automotive',
    eyebrow: 'For automotive service teams',
    headline: 'Make trust visible from estimate to pickup.',
    lede: 'Replova helps automotive businesses respond to every review and understand how customers experience pricing, advisor updates, repair quality, and turnaround time.',
    businesses: ['Independent repair shops', 'Dealer service centers', 'Collision and tire centers', 'Detailing businesses'],
    moments: [
      { title: 'Estimate', detail: 'Price transparency, explanation, options, and approval.' },
      { title: 'In service', detail: 'Status updates, changed timelines, and additional work.' },
      { title: 'Pickup', detail: 'Final invoice clarity, repair confidence, and convenience.' },
    ],
    signals: ['Advisor communication', 'Estimate transparency', 'Turnaround time', 'Repair confidence'],
    workflow: [
      { title: 'Prioritize trust gaps', detail: 'Separate a repair concern from a communication or timing issue.' },
      { title: 'Draft a specific reply', detail: 'Address what happened without sounding defensive or scripted.' },
      { title: 'Coach from evidence', detail: 'Use repeated customer language to improve advisor and pickup practices.' },
    ],
    example: {
      review: 'The work was done correctly, but pickup was nearly forty minutes late and I did not get an update.',
      response: 'We are glad the repair was completed correctly, but we missed the mark on pickup timing and communication. You deserved an update before the promised time changed.',
      insight: 'Repair quality is not the issue; proactive status updates would protect the rating.',
    },
  },
  {
    slug: 'professional-services',
    name: 'Professional services',
    navName: 'Professional services',
    eyebrow: 'For expertise-led firms',
    headline: 'Keep every client interaction clear, consistent, and accountable.',
    lede: 'Use review feedback to strengthen responsiveness, expectation-setting, clarity, and the client experience across every professional and office.',
    businesses: ['Accounting and tax firms', 'Real estate teams', 'Legal and consulting offices', 'Financial professionals'],
    moments: [
      { title: 'First response', detail: 'Availability, intake clarity, and confidence in the next step.' },
      { title: 'Engagement', detail: 'Communication cadence, expertise, transparency, and ownership.' },
      { title: 'Completion', detail: 'Outcome explanation, documentation, and continued support.' },
    ],
    signals: ['Response time', 'Expectation-setting', 'Clarity of advice', 'Ownership and follow-through'],
    workflow: [
      { title: 'Centralize the public voice', detail: 'Give every office the same review-response standard.' },
      { title: 'Respond with restraint', detail: 'Acknowledge feedback without exposing confidential client details.' },
      { title: 'Compare service patterns', detail: 'See where communication practices vary across people or locations.' },
    ],
    example: {
      review: 'The advice was useful, but I often did not know when I would hear back or what happened next.',
      response: 'Thank you for the candid feedback. We are glad the guidance was useful, and we are reviewing how we set communication timelines so the next step is always clear.',
      insight: 'Expertise is valued; inconsistent expectation-setting is weakening the experience.',
    },
  },
  {
    slug: 'retail-hospitality',
    name: 'Retail & hospitality',
    navName: 'Retail & hospitality',
    eyebrow: 'For high-volume customer experiences',
    headline: 'See what changes across shifts, locations, and customer moments.',
    lede: 'Replova helps retail and hospitality teams keep up with review volume while tracking service, atmosphere, product quality, cleanliness, and value.',
    businesses: ['Retail stores', 'Restaurants and cafés', 'Hotels and short stays', 'Entertainment venues'],
    moments: [
      { title: 'Arrival', detail: 'Welcome, wait, cleanliness, atmosphere, and first impression.' },
      { title: 'Service', detail: 'Attentiveness, product knowledge, order accuracy, and recovery.' },
      { title: 'Value', detail: 'Quality, pricing, convenience, and likelihood to return.' },
    ],
    signals: ['Shift-level service', 'Cleanliness themes', 'Product consistency', 'Perceived value'],
    workflow: [
      { title: 'Triage review volume', detail: 'Bring the reviews that need attention to the top of the queue.' },
      { title: 'Keep replies local', detail: 'Use the right tone and context for the location and experience.' },
      { title: 'Compare locations', detail: 'Spot where service themes are improving or drifting.' },
    ],
    example: {
      review: 'The food was great and our server was friendly, but the front area felt disorganized when we arrived.',
      response: 'Thank you for recognizing the food and service. We are also taking your arrival experience seriously and reviewing how we manage the front area during busy periods.',
      insight: 'Core product and table service are strong; arrival flow is the main point of friction.',
    },
  },
  {
    slug: 'local-businesses',
    name: 'Other local businesses',
    navName: 'Other local businesses',
    eyebrow: 'For every business built on local trust',
    headline: 'Adapt review operations to the business you actually run.',
    lede: 'Replova is category-aware without forcing you into a narrow template. It learns from your listing, your review language, and the customer moments that matter to your business.',
    businesses: ['Fitness and education', 'Pet and personal services', 'Local attractions', 'Multi-location portfolios'],
    moments: [
      { title: 'Discovery', detail: 'What customers expected before they chose the business.' },
      { title: 'Experience', detail: 'The service, product, people, and environment they encountered.' },
      { title: 'Return', detail: 'Whether the outcome, value, and follow-up earned another visit.' },
    ],
    signals: ['Business-specific themes', 'Customer expectations', 'Staff recognition', 'Repeat friction points'],
    workflow: [
      { title: 'Start with real reviews', detail: 'Use actual customer language instead of a preset industry script.' },
      { title: 'Set the right voice', detail: 'Choose a reply style and keep judgment with the business owner.' },
      { title: 'Build your own signal set', detail: 'Let themes emerge from the experience your customers describe.' },
    ],
    example: {
      review: 'Everyone was helpful and the experience was easy, but it took a few messages to understand what to bring.',
      response: 'Thank you for sharing this. We are glad the experience itself felt easy, and we are improving the information customers receive beforehand so preparation is clearer.',
      insight: 'The service experience is positive; pre-visit instructions are the clearest improvement opportunity.',
    },
  },
] as const

export function getIndustrySolution(slug: string) {
  return industrySolutions.find(solution => solution.slug === slug)
}
