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
    comment: string
    action: string
    issue: string
  }
}

export const industrySolutions: readonly IndustrySolution[] = [
  {
    slug: 'healthcare-wellness',
    name: 'Healthcare & wellness',
    navName: 'Healthcare & wellness',
    eyebrow: 'For care-centered businesses',
    headline: 'Make check-in clear for every visitor.',
    lede: 'Use private visit feedback to see where check-in, scheduling, and follow-up instructions are working for patients and studio members.',
    businesses: ['Dental practices', 'Med spas', 'Physical therapy', 'Wellness studios'],
    moments: [
      { title: 'Before the visit', detail: 'Appointment access, reminders, directions, and expectations.' },
      { title: 'During the experience', detail: 'Wait time, staff communication, comfort, and clarity.' },
      { title: 'After the visit', detail: 'Follow-up instructions, responsiveness, and continuity.' },
    ],
    signals: ['Scheduling friction', 'Staff communication', 'Wait-time patterns', 'Follow-up clarity'],
    workflow: [
      { title: 'Ask at the end of a visit', detail: 'Place the Tap placard where people can rate their experience privately as they leave.' },
      { title: 'Read the check-in comments', detail: 'Select the location and see whether visitors mention finding the entrance or checking in for the first time.' },
      { title: 'Try clearer instructions', detail: 'Record the change in a Playbook and check later visits for the same concern.' },
    ],
    example: {
      comment: 'I arrived for my first visit and could not tell where to check in.',
      action: 'Place check-in instructions at the entrance. Ask the front desk to check later first-visit comments.',
      issue: 'The entrance gives a first-time visitor no clear check-in point.',
    },
  },
  {
    slug: 'home-services',
    name: 'Home services',
    navName: 'Home services',
    eyebrow: 'For teams working in the home',
    headline: 'Turn service-call feedback into a more dependable operation.',
    lede: 'Invite homeowners to rate a service visit privately. Their comments can tell you about arrival windows, workmanship, cleanup, and follow-through.',
    businesses: ['HVAC and plumbing', 'Electrical services', 'Roofing and restoration', 'Cleaning and landscaping'],
    moments: [
      { title: 'Booking', detail: 'Speed to answer, scheduling clarity, and arrival expectations.' },
      { title: 'On site', detail: 'Professionalism, explanation, workmanship, and respect for the home.' },
      { title: 'Closeout', detail: 'Cleanup, invoicing, warranty guidance, and promised follow-up.' },
    ],
    signals: ['Arrival-time accuracy', 'Estimate clarity', 'Technician communication', 'Cleanup and follow-through'],
    workflow: [
      { title: 'Ask after the service call', detail: 'Offer the placard when the work is complete so the homeowner can rate the visit.' },
      { title: 'Look for repeated delays', detail: 'Read the comments for the service location. Check whether customers mention arrival estimates or missed updates.' },
      { title: 'Agree on an update', detail: 'Use a Playbook to track a change to the way the dispatch team communicates a delay.' },
    ],
    example: {
      comment: 'My arrival window changed twice. I only found out when I called the office.',
      action: 'Have the dispatcher text the revised window as soon as the technician reports a delay.',
      issue: 'The homeowner had to chase the revised arrival time.',
    },
  },
  {
    slug: 'automotive',
    name: 'Automotive',
    navName: 'Automotive',
    eyebrow: 'For automotive service teams',
    headline: 'Make trust visible from estimate to pickup.',
    lede: 'See what drivers say privately about drop-off instructions, estimates, repair quality, and updates from their service advisor.',
    businesses: ['Independent repair shops', 'Dealer service centers', 'Collision and tire centers', 'Detailing businesses'],
    moments: [
      { title: 'Estimate', detail: 'Price transparency, explanation, options, and approval.' },
      { title: 'In service', detail: 'Status updates, changed timelines, and additional work.' },
      { title: 'Pickup', detail: 'Final invoice clarity, repair confidence, and convenience.' },
    ],
    signals: ['Advisor communication', 'Estimate transparency', 'Turnaround time', 'Repair confidence'],
    workflow: [
      { title: 'Collect visit feedback', detail: 'Give drivers a place to tap or scan when they collect their vehicle.' },
      { title: 'Check the handoff', detail: 'Open the location’s inbox to see whether comments describe an unclear estimate, a delay, or difficulty finding the key drop.' },
      { title: 'Track the change', detail: 'Record a clearer set of drop-off instructions in a Playbook and review later feedback.' },
    ],
    example: {
      comment: 'I found the overnight key box, but I could not tell where to park.',
      action: 'Mark the overnight spaces and post matching directions on the key box. Check the next week of drop-off comments.',
      issue: 'The key box is visible. The overnight parking instructions are missing.',
    },
  },
  {
    slug: 'professional-services',
    name: 'Professional services',
    navName: 'Professional services',
    eyebrow: 'For expertise-led firms',
    headline: 'Give clients a clear next step.',
    lede: 'Find out whether clients at each office understood the advice they received and knew when they would hear from you again.',
    businesses: ['Accounting and tax firms', 'Real estate teams', 'Legal and consulting offices', 'Financial professionals'],
    moments: [
      { title: 'First response', detail: 'Availability, intake clarity, and confidence in the next step.' },
      { title: 'Engagement', detail: 'Communication cadence, expertise, transparency, and ownership.' },
      { title: 'Completion', detail: 'Outcome explanation, documentation, and continued support.' },
    ],
    signals: ['Response time', 'Expectation-setting', 'Clarity of advice', 'Ownership and follow-through'],
    workflow: [
      { title: 'Invite a private rating', detail: 'Let clients rate their visit and add a comment about the experience.' },
      { title: 'Read feedback by office', detail: 'Select an office and check the visits behind a recurring concern, such as unclear next steps.' },
      { title: 'Clarify the follow-up', detail: 'Use a Playbook to track a change to the instructions clients take home.' },
    ],
    example: {
      comment: 'I left knowing my options, but I did not know who would call or when.',
      action: 'Have the account lead write down the next step, the follow-up date and the name of the person responsible.',
      issue: 'The client left without a named follow-up owner.',
    },
  },
  {
    slug: 'retail-hospitality',
    name: 'Retail & hospitality',
    navName: 'Retail & hospitality',
    eyebrow: 'For high-volume customer experiences',
    headline: 'See where customers need a hand.',
    lede: 'Read private feedback on the welcome, the service, and how easily customers find what they need at each location.',
    businesses: ['Retail stores', 'Restaurants and cafés', 'Hotels and short stays', 'Entertainment venues'],
    moments: [
      { title: 'Arrival', detail: 'Welcome, wait, cleanliness, atmosphere, and first impression.' },
      { title: 'Service', detail: 'Attentiveness, product knowledge, order accuracy, and recovery.' },
      { title: 'Value', detail: 'Quality, pricing, convenience, and likelihood to return.' },
    ],
    signals: ['Service by time of visit', 'Cleanliness themes', 'Product consistency', 'Perceived value'],
    workflow: [
      { title: 'Invite feedback on the visit', detail: 'Put a Tap placard where customers can easily reach it on their way out.' },
      { title: 'Find the sticking point', detail: 'Read the original comments for the selected location. Several shoppers might describe looking for the same desk.' },
      { title: 'Track a practical fix', detail: 'Record a task to improve wayfinding in a Playbook, then check what later visitors say.' },
    ],
    example: {
      comment: 'The associate explained the return policy clearly. I walked around twice before I found the returns desk.',
      action: 'Have the floor lead walk the route from the entrance and add a sign at the first unclear turn.',
      issue: 'The return policy was clear. The route to the desk needs attention.',
    },
  },
  {
    slug: 'local-businesses',
    name: 'Other local businesses',
    navName: 'Other local businesses',
    eyebrow: 'Other local businesses',
    headline: 'Learn what makes a visit work.',
    lede: 'Give customers a way to rate their visit and tell you what stood out. Use their comments to choose an improvement for that location.',
    businesses: ['Fitness and education', 'Pet and personal services', 'Local attractions', 'Multi-location portfolios'],
    moments: [
      { title: 'Discovery', detail: 'What customers expected before they chose the business.' },
      { title: 'Experience', detail: 'The service, product, people, and environment they encountered.' },
      { title: 'Return', detail: 'Whether the outcome, value, and follow-up earned another visit.' },
    ],
    signals: ['Unclear arrival instructions', 'Customer expectations', 'Staff recognition', 'Repeat friction points'],
    workflow: [
      { title: 'Offer a placard', detail: 'Customers tap or scan to send a private rating and an optional comment.' },
      { title: 'Choose a location', detail: 'Read that location’s feedback and the comments behind a recurring issue.' },
      { title: 'Follow up in a Playbook', detail: 'Record the change your team will try and return to review the result.' },
    ],
    example: {
      comment: 'I reached the building on time, but the entrance I tried was locked.',
      action: 'Include the entrance name and a landmark in the arrival message. Check later comments for the same problem.',
      issue: 'The arrival instructions did not identify the customer entrance.',
    },
  },
] as const

export function getIndustrySolution(slug: string) {
  return industrySolutions.find(solution => solution.slug === slug)
}
