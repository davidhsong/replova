export const FEEDBACK_DEMO_DATASET_VERSION = 1
export const FEEDBACK_DEMO_BUSINESS_NAME = 'Northline Auto Care'
export const FEEDBACK_DEMO_LABEL = 'Synthetic demo workspace'

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative'
export type FeedbackIssueStatus = 'none' | 'new' | 'in_progress' | 'resolved'
export type FeedbackFollowUpStatus = 'not_needed' | 'not_started' | 'contacted' | 'awaiting_reply' | 'confirmed_resolved'
export type DemoTaskPriority = 'high' | 'medium' | 'low'
export type DemoTaskStatus = 'todo' | 'in_progress' | 'done'

export interface DemoFeedbackEntry {
  id: string
  customerName: string
  channel: 'Post-service survey' | 'SMS follow-up' | 'Email feedback'
  service: string
  rating: number
  text: string
  sentiment: FeedbackSentiment
  themes: string[]
  receivedAt: string
  requiresRecovery: boolean
  issueStatus: FeedbackIssueStatus
  resolutionNote: string
  followUpStatus: FeedbackFollowUpStatus
}

export interface DemoAnalysisFinding {
  id: string
  title: string
  theme: string
  severity: 'high' | 'medium' | 'low'
  summary: string
  recommendation: string
  supportingFeedbackIds: string[]
  confidence: number
}

export interface DemoAnalysisTheme {
  id: string
  name: string
  sentiment: FeedbackSentiment | 'mixed'
  summary: string
  supportingFeedbackIds: string[]
}

export interface DemoFeedbackAnalysis {
  executiveSummary: string
  findings: DemoAnalysisFinding[]
  themes: DemoAnalysisTheme[]
  generatedAt: string
  model: string
}

export interface DemoImprovementTask {
  id: string
  title: string
  owner: string
  priority: DemoTaskPriority
  status: DemoTaskStatus
  linkedFindingId: string | null
  createdAt: string
  completedAt: string | null
}

export interface FeedbackDemoState {
  version: number
  resetAt: string
  feedback: DemoFeedbackEntry[]
  tasks: DemoImprovementTask[]
  analysis: DemoFeedbackAnalysis | null
}

export interface FeedbackDemoMetrics {
  totalFeedback: number
  newFeedback: number
  issueCount: number
  unresolvedIssues: number
  resolvedIssues: number
  resolutionRate: number
  completedTasks: number
  totalTasks: number
  sentiment: Record<FeedbackSentiment, number>
}

// Verified with Replova's OpenAI Responses integration on November 15, 2026.
// The authenticated demo endpoint can refresh this snapshot from the same 60
// canonical records without sending or publishing content to another platform.
export const DEFAULT_FEEDBACK_DEMO_ANALYSIS: DemoFeedbackAnalysis = {
  executiveSummary: 'The most frequent operational concern is unreliable communication about progress and completion. Customers also describe gaps in estimate clarity and authorization, appointment and wait-time accuracy, and follow-up on repairs that need a recheck. Positive feedback points to clear explanations, practical prioritization, and useful digital updates as strengths to preserve.',
  findings: [
    {
      id: 'finding-1',
      title: 'Progress and completion updates are often late or missing',
      theme: 'Customer communication',
      severity: 'high',
      summary: 'Customers repeatedly report waiting past promised update windows, having to call for status, or learning about delays too late to plan. Some also report receiving inconsistent completion estimates or repeating questions to different staff.',
      recommendation: 'For 30 days, assign one staff owner to every open repair order and log the next update time at check-in. Send a status text or call by that time, including when there is no change. Review the share of updates sent on time each week and target at least 90%.',
      supportingFeedbackIds: ['feedback-001', 'feedback-002', 'feedback-003', 'feedback-004', 'feedback-005', 'feedback-006', 'feedback-007', 'feedback-008', 'feedback-009', 'feedback-010', 'feedback-012'],
      confidence: 0.99,
    },
    {
      id: 'finding-2',
      title: 'Estimate details and added-work approvals are not consistently clear',
      theme: 'Estimate transparency and authorization',
      severity: 'high',
      summary: 'Multiple customers describe totals that differed from what they understood they approved, including omitted fees or charges and additional work started without clear approval. Other feedback shows that itemized estimates and clearly presented options are valued.',
      recommendation: 'For 30 days, use a written estimate template showing parts, labor, taxes, fees, and diagnostic charges, plus a separate line for each optional item. Require a recorded customer approval for any added work before starting it. Audit 10 closed repair orders each week for completeness.',
      supportingFeedbackIds: ['feedback-013', 'feedback-014', 'feedback-015', 'feedback-016', 'feedback-017', 'feedback-018', 'feedback-019', 'feedback-020', 'feedback-022'],
      confidence: 0.99,
    },
    {
      id: 'finding-3',
      title: 'Appointment and wait-time expectations do not always match shop capacity',
      theme: 'Scheduling and arrival expectations',
      severity: 'medium',
      summary: 'Customers report late bay starts, waits substantially longer than quoted, online openings that were not available in practice, and a booking time before doors opened. Some describe better experiences when staff promptly explained a delay and gave a realistic time.',
      recommendation: 'For 30 days, compare booked arrival times with opening hours and available bay capacity before publishing or confirming slots. At check-in, record the estimated start and completion times, then notify customers of any delay exceeding 15 minutes. Review late starts and wait-estimate misses weekly.',
      supportingFeedbackIds: ['feedback-023', 'feedback-024', 'feedback-025', 'feedback-026', 'feedback-027', 'feedback-028', 'feedback-029'],
      confidence: 0.98,
    },
    {
      id: 'finding-4',
      title: 'Repair rechecks and returning problems need a clearer response path',
      theme: 'Repair quality and follow-up',
      severity: 'medium',
      summary: 'Several customers report a symptom or concern remaining after service, a repeat visit needed to correct the result, or a slow response when seeking follow-up. Other feedback describes a weak part being caught before pickup, showing the value of a final check.',
      recommendation: 'For 30 days, route every post-repair concern to one service advisor and log the symptom, contact time, and proposed next step on the repair order. Contact the customer by the next business day and offer a recheck plan. Review open and overdue recheck requests every morning.',
      supportingFeedbackIds: ['feedback-045', 'feedback-046', 'feedback-047', 'feedback-048', 'feedback-049', 'feedback-050'],
      confidence: 0.98,
    },
    {
      id: 'finding-5',
      title: 'Pickup checks sometimes miss cleanliness or vehicle-return details',
      theme: 'Pickup condition and final inspection',
      severity: 'low',
      summary: 'Customers mention grease, fingerprints, leftover materials, a moved seat, dust, or a missing trim clip at pickup. Positive examples describe a clean vehicle, restored seat position, and work that was checked before the customer left.',
      recommendation: 'For 30 days, add a five-point pickup check to each repair order: steering wheel and driver door clean, seat position restored, protective materials removed, work area checked for loose items, and exterior work area inspected. Record completion before notifying the customer that the vehicle is ready.',
      supportingFeedbackIds: ['feedback-031', 'feedback-032', 'feedback-033', 'feedback-034', 'feedback-035', 'feedback-036'],
      confidence: 0.96,
    },
  ],
  themes: [
    {
      id: 'theme-1',
      name: 'Progress and completion communication',
      sentiment: 'negative',
      summary: 'Customers often want timely status updates, a reliable completion estimate, and one clear point of contact.',
      supportingFeedbackIds: ['feedback-001', 'feedback-002', 'feedback-003', 'feedback-004', 'feedback-005', 'feedback-006', 'feedback-007', 'feedback-008', 'feedback-009', 'feedback-010', 'feedback-012'],
    },
    {
      id: 'theme-2',
      name: 'Clear diagnosis and practical advice',
      sentiment: 'positive',
      summary: 'Customers value explanations supported by inspection evidence, realistic repair timing, and prioritization that avoids pressure or unrelated work.',
      supportingFeedbackIds: ['feedback-037', 'feedback-038', 'feedback-039', 'feedback-040', 'feedback-041', 'feedback-042', 'feedback-043', 'feedback-057', 'feedback-058', 'feedback-059'],
    },
    {
      id: 'theme-3',
      name: 'Estimate clarity and approval',
      sentiment: 'mixed',
      summary: 'Some customers describe surprise costs or work performed without clear approval, while others praise itemized totals, visible options, and explanations of tradeoffs.',
      supportingFeedbackIds: ['feedback-013', 'feedback-014', 'feedback-015', 'feedback-016', 'feedback-017', 'feedback-018', 'feedback-019', 'feedback-020', 'feedback-022'],
    },
    {
      id: 'theme-4',
      name: 'Appointment and wait-time accuracy',
      sentiment: 'mixed',
      summary: 'Booked times and quoted waits are sometimes inaccurate, though customers value prompt notice and realistic revised estimates.',
      supportingFeedbackIds: ['feedback-023', 'feedback-024', 'feedback-025', 'feedback-026', 'feedback-027', 'feedback-028', 'feedback-029', 'feedback-030'],
    },
    {
      id: 'theme-5',
      name: 'Repair rechecks and follow-up',
      sentiment: 'negative',
      summary: 'Customers describe unresolved symptoms, repeat visits, and delayed responses to recheck requests; one customer describes a weak replacement part caught before pickup.',
      supportingFeedbackIds: ['feedback-045', 'feedback-046', 'feedback-047', 'feedback-048', 'feedback-049', 'feedback-050'],
    },
    {
      id: 'theme-6',
      name: 'Vehicle condition at pickup',
      sentiment: 'mixed',
      summary: 'Some customers find residue, moved seats, leftover materials, or a missing part, while others appreciate clean return and a thorough final check.',
      supportingFeedbackIds: ['feedback-031', 'feedback-032', 'feedback-033', 'feedback-034', 'feedback-035', 'feedback-036'],
    },
    {
      id: 'theme-7',
      name: 'Digital service tools and handoffs',
      sentiment: 'mixed',
      summary: 'Photos and digital payment can make approval or checkout easier, while after-hours instructions and receipt access are not always clear.',
      supportingFeedbackIds: ['feedback-051', 'feedback-052', 'feedback-053', 'feedback-054', 'feedback-055'],
    },
  ],
  generatedAt: '2026-11-15T08:55:08.747Z',
  model: 'gpt-6-luna',
}

type SeedEntry = Omit<DemoFeedbackEntry, 'receivedAt'> & { daysAgo: number }

const seeds: SeedEntry[] = [
  {
    id: 'feedback-001', customerName: 'Marisol Vega', daysAgo: 1, channel: 'SMS follow-up', service: 'Brake inspection', rating: 2,
    text: 'The repair itself seems fine, but I went most of the afternoon without an update and had to call twice to learn the car would not be ready.',
    sentiment: 'negative', themes: ['status updates', 'completion timing'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-002', customerName: 'Darnell Brooks', daysAgo: 2, channel: 'Post-service survey', service: 'Cooling system repair', rating: 2,
    text: 'I was told someone would call after the diagnosis. The call never came, and I only found out the estimate was ready when I checked near closing.',
    sentiment: 'negative', themes: ['status updates', 'estimate approval'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Service advisor left a voicemail and is preparing a timeline of the visit.', followUpStatus: 'contacted',
  },
  {
    id: 'feedback-003', customerName: 'Priya Raman', daysAgo: 3, channel: 'Email feedback', service: 'Check-engine diagnosis', rating: 3,
    text: 'The diagnosis was explained clearly once I reached someone. A short text saying the car was still being tested would have saved me from wondering all day.',
    sentiment: 'neutral', themes: ['status updates', 'diagnosis explanation'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-004', customerName: 'Mateo Salazar', daysAgo: 4, channel: 'SMS follow-up', service: 'Alternator replacement', rating: 1,
    text: 'I arranged a ride based on a noon pickup. No one contacted me when the part was delayed, and the car was not ready until the next morning.',
    sentiment: 'negative', themes: ['status updates', 'completion timing', 'parts delay'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-005', customerName: 'Elena Kovacs', daysAgo: 5, channel: 'Post-service survey', service: 'Oil leak repair', rating: 2,
    text: 'Everyone was polite, but the promised update window passed by three hours. I need reliable timing because I coordinate school pickup around the shop.',
    sentiment: 'negative', themes: ['status updates', 'completion timing'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-006', customerName: 'Terrence Wu', daysAgo: 6, channel: 'Post-service survey', service: 'Transmission service', rating: 4,
    text: 'Good work and a clear invoice. The only gap was not hearing anything between the morning drop-off and the pickup message late in the day.',
    sentiment: 'positive', themes: ['status updates', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-007', customerName: 'Nia Holloway', daysAgo: 8, channel: 'SMS follow-up', service: 'Battery and charging test', rating: 2,
    text: 'The front desk said they would call within an hour. I waited nearly four hours and had to start the conversation myself.',
    sentiment: 'negative', themes: ['status updates', 'wait time'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Owner apologized and refunded the diagnostic fee. Customer accepted the resolution.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-008', customerName: 'Anders Lind', daysAgo: 10, channel: 'Email feedback', service: 'Suspension inspection', rating: 3,
    text: 'The inspection notes were useful. I would prefer one point of contact instead of repeating my question to the desk and then the technician.',
    sentiment: 'neutral', themes: ['status updates', 'handoff consistency'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-009', customerName: 'Jocelyn Park', daysAgo: 12, channel: 'Post-service survey', service: 'Starter replacement', rating: 1,
    text: 'My car stayed overnight, but nobody told me before the shop closed. I had medication in the vehicle and could not get it until morning.',
    sentiment: 'negative', themes: ['status updates', 'completion timing'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Manager delivered the vehicle that evening and added an after-hours escalation note to the account.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-010', customerName: 'Rafael Ibarra', daysAgo: 14, channel: 'SMS follow-up', service: 'A/C diagnosis', rating: 2,
    text: 'I approved diagnostic time in the morning and did not receive the findings until twenty minutes before closing, leaving no time to discuss options.',
    sentiment: 'negative', themes: ['status updates', 'diagnosis explanation'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Follow-up appointment offered to review repair options without another diagnostic charge.', followUpStatus: 'awaiting_reply',
  },
  {
    id: 'feedback-011', customerName: 'Sloane Mercer', daysAgo: 17, channel: 'Post-service survey', service: 'Tire rotation', rating: 4,
    text: 'Friendly team and the car was ready when promised. The pickup text was helpful and included the exact closing time.',
    sentiment: 'positive', themes: ['status updates', 'completion timing'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-012', customerName: 'Kwame Mensah', daysAgo: 20, channel: 'Email feedback', service: 'Electrical diagnosis', rating: 2,
    text: 'Three different people gave me three different completion estimates. The final repair was good, but the communication made planning difficult.',
    sentiment: 'negative', themes: ['status updates', 'handoff consistency', 'completion timing'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Shop reviewed the timeline with the customer and assigned one advisor for the return visit.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-013', customerName: 'Inez Calderon', daysAgo: 1, channel: 'Email feedback', service: 'Front brake replacement', rating: 2,
    text: 'The final total was about two hundred dollars above the first number. I approved the brake job but did not realize the quote excluded the fluid service and shop supplies.',
    sentiment: 'negative', themes: ['estimate clarity', 'estimate approval'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-014', customerName: 'Cyrus Bennett', daysAgo: 3, channel: 'Post-service survey', service: 'Wheel bearing replacement', rating: 1,
    text: 'A second bearing was added after I approved the first estimate. I understand why it was needed, but nobody asked me before the additional work started.',
    sentiment: 'negative', themes: ['estimate approval', 'authorization'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-015', customerName: 'Hana Okafor', daysAgo: 5, channel: 'SMS follow-up', service: 'Fuel system cleaning', rating: 2,
    text: 'The service advisor described the total as all-in, but the invoice included a separate disposal fee. The amount was small; the surprise was the problem.',
    sentiment: 'negative', themes: ['estimate clarity', 'invoice clarity'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Advisor sent an itemized explanation and offered to credit the disposal fee.', followUpStatus: 'contacted',
  },
  {
    id: 'feedback-016', customerName: 'Louis Fontaine', daysAgo: 7, channel: 'Post-service survey', service: 'Timing belt service', rating: 4,
    text: 'The estimate listed parts, labor, and taxes separately, which made the decision easy. I appreciated seeing the optional work clearly marked.',
    sentiment: 'positive', themes: ['estimate clarity', 'invoice clarity'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-017', customerName: 'Talia Moreno', daysAgo: 9, channel: 'Email feedback', service: 'Engine mount replacement', rating: 3,
    text: 'The repair helped, but I received the estimate as a single total. I would have liked the parts and labor split before approving it.',
    sentiment: 'neutral', themes: ['estimate clarity', 'estimate approval'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-018', customerName: 'Bennett Cole', daysAgo: 12, channel: 'SMS follow-up', service: 'Radiator replacement', rating: 2,
    text: 'I agreed to the radiator price over the phone. At pickup there was an extra hose charge that had not been mentioned during approval.',
    sentiment: 'negative', themes: ['estimate approval', 'invoice clarity'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Unapproved hose charge was removed and approval notes were added to the repair order.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-019', customerName: 'Mei-Ling Foster', daysAgo: 15, channel: 'Post-service survey', service: 'Exhaust repair', rating: 5,
    text: 'I received two repair options with the tradeoffs and exact totals. There was no pressure to choose the more expensive option.',
    sentiment: 'positive', themes: ['estimate clarity', 'trust'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-020', customerName: 'Omar Haddad', daysAgo: 18, channel: 'Email feedback', service: 'Power steering repair', rating: 2,
    text: 'The work was authorized, but the estimate text did not show taxes or the diagnostic charge. The final invoice felt different from what I accepted.',
    sentiment: 'negative', themes: ['estimate clarity', 'estimate approval', 'invoice clarity'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Owner is reviewing the estimate template before contacting the customer.', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-021', customerName: 'Greta Nilsson', daysAgo: 23, channel: 'SMS follow-up', service: 'Spark plug replacement', rating: 3,
    text: 'Everything was completed correctly. The invoice uses abbreviations that are probably clear to a mechanic but were not clear to me.',
    sentiment: 'neutral', themes: ['invoice clarity', 'education'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-022', customerName: 'Devon McBride', daysAgo: 29, channel: 'Post-service survey', service: 'Control arm replacement', rating: 1,
    text: 'The shop replaced an alignment-related part after leaving me one voicemail. I did not approve the added work and learned about it at checkout.',
    sentiment: 'negative', themes: ['authorization', 'estimate approval'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Added labor was refunded and written authorization is now required on the account.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-023', customerName: 'Amina Rahal', daysAgo: 2, channel: 'Post-service survey', service: 'Oil change', rating: 2,
    text: 'I had an 8:30 appointment but the car did not enter a bay until after 9:20. I wish the booking time reflected the actual start time.',
    sentiment: 'negative', themes: ['appointment wait', 'scheduling'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-024', customerName: 'Colin Baptiste', daysAgo: 4, channel: 'SMS follow-up', service: 'State inspection', rating: 3,
    text: 'The inspection was thorough. The waiting room estimate was forty minutes, but I was there for almost ninety.',
    sentiment: 'neutral', themes: ['appointment wait', 'completion timing'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-025', customerName: 'Yara Petrov', daysAgo: 6, channel: 'Email feedback', service: 'Pre-purchase inspection', rating: 5,
    text: 'They started on time, sent photos, and finished within the promised window. The report helped me avoid a costly purchase.',
    sentiment: 'positive', themes: ['scheduling', 'diagnosis explanation', 'trust'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-026', customerName: 'Malik Thompson', daysAgo: 9, channel: 'Post-service survey', service: 'Alignment', rating: 2,
    text: 'Online booking showed a morning opening, but the desk said they were already backed up when I arrived. The alignment took most of the day.',
    sentiment: 'negative', themes: ['scheduling', 'appointment wait', 'completion timing'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Customer was offered priority scheduling for the recheck.', followUpStatus: 'awaiting_reply',
  },
  {
    id: 'feedback-027', customerName: 'Celeste Quinn', daysAgo: 13, channel: 'SMS follow-up', service: 'Tire replacement', rating: 4,
    text: 'The appointment started a little late, but the advisor told me immediately and offered a realistic completion time.',
    sentiment: 'positive', themes: ['appointment wait', 'status updates'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-028', customerName: 'Rishi Batra', daysAgo: 19, channel: 'Post-service survey', service: 'Brake fluid service', rating: 1,
    text: 'I waited at the counter while two walk-ins were checked in ahead of me even though I had booked and prepaid online.',
    sentiment: 'negative', themes: ['appointment wait', 'check-in process'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Prepaid amount was refunded and the shop documented a dedicated prepaid check-in lane.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-029', customerName: 'Maren Doyle', daysAgo: 24, channel: 'Email feedback', service: 'Seasonal maintenance', rating: 3,
    text: 'The calendar let me choose 7:30, but the doors opened at 8. The team was apologetic once someone arrived.',
    sentiment: 'neutral', themes: ['scheduling', 'check-in process'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-030', customerName: 'Solomon Price', daysAgo: 31, channel: 'Post-service survey', service: 'Emissions test', rating: 5,
    text: 'Fast check-in, accurate wait estimate, and the paperwork was ready before I reached the desk.',
    sentiment: 'positive', themes: ['check-in process', 'completion timing'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-031', customerName: 'Leona Fischer', daysAgo: 3, channel: 'SMS follow-up', service: 'Interior detail after repair', rating: 2,
    text: 'The mechanical work was good, but there was dark grease on the steering wheel and driver door when I picked up the car.',
    sentiment: 'negative', themes: ['pickup cleanliness', 'quality control'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-032', customerName: 'Bryce Tanaka', daysAgo: 7, channel: 'Post-service survey', service: 'Cabin air filter replacement', rating: 3,
    text: 'The service was quick. The passenger seat had been moved all the way back and the protective floor paper was left in the car.',
    sentiment: 'neutral', themes: ['pickup cleanliness', 'pickup checklist'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-033', customerName: 'Anika Shah', daysAgo: 11, channel: 'Email feedback', service: 'Valve cover gasket repair', rating: 2,
    text: 'I noticed oily fingerprints on the hood and a shop rag in the trunk. The leak is fixed, but pickup did not feel finished.',
    sentiment: 'negative', themes: ['pickup cleanliness', 'pickup checklist'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Complimentary wash offered; customer is choosing a return time.', followUpStatus: 'contacted',
  },
  {
    id: 'feedback-034', customerName: 'Esteban Rios', daysAgo: 16, channel: 'Post-service survey', service: 'Full synthetic oil service', rating: 5,
    text: 'The car was cleaner than when I dropped it off, the seat was returned to position, and the invoice was waiting in the cup holder.',
    sentiment: 'positive', themes: ['pickup cleanliness', 'pickup checklist'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-035', customerName: 'Noor Alvi', daysAgo: 22, channel: 'SMS follow-up', service: 'Brake and rotor replacement', rating: 1,
    text: 'A small trim clip was missing near the wheel well after service. The shop replaced it later, but I had to make a second trip.',
    sentiment: 'negative', themes: ['pickup checklist', 'quality control', 'repeat visit'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Trim clip replaced and fuel card provided for the return trip.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-036', customerName: 'Genevieve Ross', daysAgo: 35, channel: 'Post-service survey', service: 'Detail and headlight restoration', rating: 4,
    text: 'The headlights look excellent. I found a little polishing dust around the front grille, but it wiped off easily.',
    sentiment: 'positive', themes: ['pickup cleanliness', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-037', customerName: 'Tomas Eriksen', daysAgo: 1, channel: 'Post-service survey', service: 'Noise diagnosis', rating: 5,
    text: 'The technician reproduced the noise, showed me the worn link, and explained why it was safe to wait two weeks before repairing it.',
    sentiment: 'positive', themes: ['diagnosis explanation', 'trust', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-038', customerName: 'Roxana Bell', daysAgo: 4, channel: 'Email feedback', service: 'Cooling fan replacement', rating: 5,
    text: 'I appreciated the photos and the old part being available at pickup. The temperature has stayed normal since the repair.',
    sentiment: 'positive', themes: ['diagnosis explanation', 'trust', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-039', customerName: 'Imani Cross', daysAgo: 6, channel: 'SMS follow-up', service: 'Rear brake service', rating: 5,
    text: 'They caught uneven pad wear before a road trip and explained the cause without pushing unrelated work.',
    sentiment: 'positive', themes: ['trust', 'diagnosis explanation'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-040', customerName: 'Felix Navarro', daysAgo: 9, channel: 'Post-service survey', service: 'Clutch diagnosis', rating: 4,
    text: 'The advisor gave me a realistic range before teardown and called before spending additional diagnostic time.',
    sentiment: 'positive', themes: ['estimate approval', 'trust'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-041', customerName: 'Sabine Laurent', daysAgo: 13, channel: 'Email feedback', service: 'Hybrid system inspection', rating: 5,
    text: 'Another shop recommended a major battery repair. Northline found a damaged connector and fixed the actual problem for much less.',
    sentiment: 'positive', themes: ['trust', 'diagnosis accuracy', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-042', customerName: 'Desmond Clarke', daysAgo: 18, channel: 'Post-service survey', service: 'Steering vibration diagnosis', rating: 5,
    text: 'The technician rode with me before starting work, which made me confident they understood the exact symptom.',
    sentiment: 'positive', themes: ['diagnosis explanation', 'trust'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-043', customerName: 'Katarina Wells', daysAgo: 26, channel: 'SMS follow-up', service: 'Scheduled maintenance', rating: 4,
    text: 'No surprises and no pressure. The advisor separated what was due now from what could wait until the next service.',
    sentiment: 'positive', themes: ['trust', 'estimate clarity'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-044', customerName: 'Jerome Castillo', daysAgo: 33, channel: 'Post-service survey', service: 'Water pump replacement', rating: 5,
    text: 'The repair has held up through a long trip. The team called a week later to make sure the coolant level stayed stable.',
    sentiment: 'positive', themes: ['work quality', 'follow-up'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-045', customerName: 'Minerva Grant', daysAgo: 2, channel: 'Post-service survey', service: 'A/C repair', rating: 1,
    text: 'The air was cold for two days and then stopped again. I am waiting for a return appointment and need the second visit handled quickly.',
    sentiment: 'negative', themes: ['repeat visit', 'quality control', 'recovery'], requiresRecovery: true, issueStatus: 'new', resolutionNote: '', followUpStatus: 'not_started',
  },
  {
    id: 'feedback-046', customerName: 'Elias Boone', daysAgo: 5, channel: 'Email feedback', service: 'Brake noise repair', rating: 2,
    text: 'The original squeal is quieter but still present. I sent a video and have not received a response about the recheck.',
    sentiment: 'negative', themes: ['repeat visit', 'status updates', 'quality control'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Video assigned to the lead technician for review.', followUpStatus: 'contacted',
  },
  {
    id: 'feedback-047', customerName: 'Maya Sato', daysAgo: 8, channel: 'SMS follow-up', service: 'Oil leak repair', rating: 2,
    text: 'There is still a small spot under the car after the gasket repair. I understand leaks can have more than one source, but I need a clear next step.',
    sentiment: 'negative', themes: ['repeat visit', 'diagnosis explanation', 'recovery'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'No-charge inspection scheduled for Tuesday morning.', followUpStatus: 'contacted',
  },
  {
    id: 'feedback-048', customerName: 'Arturo Kim', daysAgo: 14, channel: 'Post-service survey', service: 'Wheel alignment', rating: 1,
    text: 'The steering wheel was still off-center after the alignment. The second alignment fixed it, but the first pickup should have caught that.',
    sentiment: 'negative', themes: ['repeat visit', 'quality control', 'pickup checklist'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Alignment repeated at no charge and printout reviewed with customer.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-049', customerName: 'Phoebe Mensah', daysAgo: 21, channel: 'Email feedback', service: 'Battery replacement', rating: 4,
    text: 'The first replacement battery tested weak, but the team caught it before I left and installed another one immediately.',
    sentiment: 'positive', themes: ['quality control', 'recovery'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-050', customerName: 'Hector Silva', daysAgo: 37, channel: 'Post-service survey', service: 'Engine misfire repair', rating: 2,
    text: 'The warning light returned after a week. The team eventually found a second coil issue, but scheduling the follow-up took too long.',
    sentiment: 'negative', themes: ['repeat visit', 'scheduling', 'recovery'], requiresRecovery: true, issueStatus: 'resolved', resolutionNote: 'Second diagnosis completed at no charge and parts labor discounted.', followUpStatus: 'confirmed_resolved',
  },
  {
    id: 'feedback-051', customerName: 'Zuri Patterson', daysAgo: 3, channel: 'SMS follow-up', service: 'After-hours drop-off', rating: 4,
    text: 'The key drop was convenient. A confirmation text in the morning would make it clearer that the car and note were received.',
    sentiment: 'positive', themes: ['after-hours drop-off', 'status updates'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-052', customerName: 'Callum Reid', daysAgo: 7, channel: 'Post-service survey', service: 'Online appointment booking', rating: 3,
    text: 'Booking was easy, but the confirmation did not say where to leave the vehicle before opening time.',
    sentiment: 'neutral', themes: ['after-hours drop-off', 'scheduling'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-053', customerName: 'Amara Dupont', daysAgo: 11, channel: 'Email feedback', service: 'After-hours pickup', rating: 2,
    text: 'I was told after-hours pickup was available, but the lockbox instructions arrived after I had already reached the shop.',
    sentiment: 'negative', themes: ['after-hours pickup', 'status updates'], requiresRecovery: true, issueStatus: 'in_progress', resolutionNote: 'Owner sent an apology and documented a two-hour instruction cutoff.', followUpStatus: 'awaiting_reply',
  },
  {
    id: 'feedback-054', customerName: 'Wesley Okoro', daysAgo: 17, channel: 'SMS follow-up', service: 'Digital inspection', rating: 5,
    text: 'The photo inspection made it easy to approve the tire work from a meeting without a phone call.',
    sentiment: 'positive', themes: ['digital convenience', 'estimate approval'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-055', customerName: 'Lina Berg', daysAgo: 28, channel: 'Post-service survey', service: 'Text-to-pay checkout', rating: 4,
    text: 'Paying by phone saved time. The receipt link was difficult to find later, so an emailed copy would help.',
    sentiment: 'positive', themes: ['digital convenience', 'invoice clarity'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-056', customerName: 'Nikolai Chen', daysAgo: 1, channel: 'SMS follow-up', service: 'Fleet van maintenance', rating: 5,
    text: 'Northline listed the safety work first and scheduled the cosmetic items for a later visit so the van could return to service quickly.',
    sentiment: 'positive', themes: ['trust', 'scheduling', 'estimate clarity'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-057', customerName: 'Araceli Dunn', daysAgo: 5, channel: 'Post-service survey', service: 'Road-trip inspection', rating: 5,
    text: 'The report separated urgent, upcoming, and monitor-only items. That made the recommendations feel practical rather than sales-driven.',
    sentiment: 'positive', themes: ['trust', 'diagnosis explanation'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-058', customerName: 'Idris Walton', daysAgo: 10, channel: 'Email feedback', service: 'Diesel maintenance', rating: 4,
    text: 'The technician explained the filter interval based on how I actually use the truck, not just the generic schedule.',
    sentiment: 'positive', themes: ['education', 'trust'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-059', customerName: 'Maeve Ortiz', daysAgo: 16, channel: 'SMS follow-up', service: 'Used-car baseline service', rating: 5,
    text: 'I received a prioritized six-month plan instead of a long list of repairs. It helped me budget without delaying the safety items.',
    sentiment: 'positive', themes: ['estimate clarity', 'trust', 'education'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
  {
    id: 'feedback-060', customerName: 'Quentin Hayes', daysAgo: 40, channel: 'Post-service survey', service: 'Headlight replacement', rating: 4,
    text: 'Straightforward service, accurate estimate, and a clear explanation of the warranty. I would return.',
    sentiment: 'positive', themes: ['estimate clarity', 'trust', 'work quality'], requiresRecovery: false, issueStatus: 'none', resolutionNote: '', followUpStatus: 'not_needed',
  },
]

function relativeDate(now: Date, daysAgo: number): string {
  const date = new Date(now)
  date.setUTCHours(16, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString()
}

export function createDemoFeedbackEntries(now = new Date()): DemoFeedbackEntry[] {
  return seeds.map(({ daysAgo, ...entry }) => ({
    ...entry,
    themes: [...entry.themes],
    receivedAt: relativeDate(now, daysAgo),
  }))
}

export function createInitialFeedbackDemoState(now = new Date()): FeedbackDemoState {
  const createdAt = now.toISOString()
  return {
    version: FEEDBACK_DEMO_DATASET_VERSION,
    resetAt: createdAt,
    feedback: createDemoFeedbackEntries(now),
    analysis: {
      ...DEFAULT_FEEDBACK_DEMO_ANALYSIS,
      findings: DEFAULT_FEEDBACK_DEMO_ANALYSIS.findings.map(finding => ({
        ...finding,
        supportingFeedbackIds: [...finding.supportingFeedbackIds],
      })),
      themes: DEFAULT_FEEDBACK_DEMO_ANALYSIS.themes.map(theme => ({
        ...theme,
        supportingFeedbackIds: [...theme.supportingFeedbackIds],
      })),
    },
    tasks: [
      {
        id: 'task-demo-001',
        title: 'Set a 3 p.m. status-update checkpoint for every open repair order',
        owner: 'Service advisor',
        priority: 'high',
        status: 'in_progress',
        linkedFindingId: null,
        createdAt,
        completedAt: null,
      },
      {
        id: 'task-demo-002',
        title: 'Add an all-in approval summary to estimate texts',
        owner: 'Shop owner',
        priority: 'high',
        status: 'todo',
        linkedFindingId: null,
        createdAt,
        completedAt: null,
      },
      {
        id: 'task-demo-003',
        title: 'Pilot a five-point pickup cleanliness check',
        owner: 'Lead technician',
        priority: 'medium',
        status: 'done',
        linkedFindingId: null,
        createdAt,
        completedAt: createdAt,
      },
    ],
  }
}

export function calculateFeedbackDemoMetrics(
  state: Pick<FeedbackDemoState, 'feedback' | 'tasks'>,
  now = new Date()
): FeedbackDemoMetrics {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000
  const issueEntries = state.feedback.filter(entry => entry.requiresRecovery)
  const resolvedIssues = issueEntries.filter(entry => entry.issueStatus === 'resolved').length
  const sentiment = state.feedback.reduce<Record<FeedbackSentiment, number>>((counts, entry) => {
    counts[entry.sentiment] += 1
    return counts
  }, { positive: 0, neutral: 0, negative: 0 })

  return {
    totalFeedback: state.feedback.length,
    newFeedback: state.feedback.filter(entry => new Date(entry.receivedAt).getTime() >= sevenDaysAgo).length,
    issueCount: issueEntries.length,
    unresolvedIssues: issueEntries.length - resolvedIssues,
    resolvedIssues,
    resolutionRate: issueEntries.length === 0 ? 0 : Math.round((resolvedIssues / issueEntries.length) * 100),
    completedTasks: state.tasks.filter(task => task.status === 'done').length,
    totalTasks: state.tasks.length,
    sentiment,
  }
}

export function isFeedbackDemoState(value: unknown): value is FeedbackDemoState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<FeedbackDemoState>
  return state.version === FEEDBACK_DEMO_DATASET_VERSION
    && typeof state.resetAt === 'string'
    && Array.isArray(state.feedback)
    && state.feedback.length === 60
    && Array.isArray(state.tasks)
    && (state.analysis === null || typeof state.analysis === 'object')
}
