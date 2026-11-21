import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  calculateFeedbackDemoMetrics,
  createDemoFeedbackEntries,
  createInitialFeedbackDemoState,
  DEFAULT_FEEDBACK_DEMO_ANALYSIS,
  FEEDBACK_DEMO_DATASET_VERSION,
  isFeedbackDemoState,
} from '../lib/feedbackDemo'
import {
  buildFeedbackAnalysisInput,
  normalizeFeedbackAnalysis,
  type RawFeedbackAnalysis,
} from '../lib/feedbackDemoAnalysisCore'

const fixtureNow = new Date('2026-11-15T18:00:00.000Z')

function validRawAnalysis(): RawFeedbackAnalysis {
  return {
    executiveSummary: 'Recurring communication, approval, and pickup-control gaps create avoidable recovery work despite strong technical trust signals.',
    findings: [
      {
        title: 'Status updates miss promised checkpoints',
        theme: 'status updates',
        severity: 'high',
        summary: 'Customers repeatedly describe initiating calls after promised update windows pass without a message.',
        recommendation: 'Assign one advisor to send a status text by 3 p.m. for every repair order still open.',
        supportingFeedbackIds: ['feedback-001', 'feedback-002', 'feedback-004', 'fabricated-id'],
        confidence: 0.93,
      },
      {
        title: 'Estimate approvals omit all-in totals',
        theme: 'estimate approval',
        severity: 'high',
        summary: 'Several customers report added fees or work that were not explicit when they approved the repair.',
        recommendation: 'Require an all-in approval message listing added work, fees, tax, and the revised total before work resumes.',
        supportingFeedbackIds: ['feedback-013', 'feedback-014', 'feedback-018'],
        confidence: 0.91,
      },
      {
        title: 'Pickup quality checks are inconsistent',
        theme: 'pickup checklist',
        severity: 'medium',
        summary: 'Grease, leftover materials, and missed fit-and-finish details appear across multiple completed visits.',
        recommendation: 'Use a five-point pickup check covering cleanliness, seat position, loose items, warning lights, and repaired-area inspection.',
        supportingFeedbackIds: ['feedback-031', 'feedback-032', 'feedback-033'],
        confidence: 0.86,
      },
    ],
    themes: [
      {
        name: 'Status updates', sentiment: 'negative',
        summary: 'Long gaps and missed promises make otherwise acceptable repairs harder to plan around.',
        supportingFeedbackIds: ['feedback-001', 'feedback-002', 'feedback-003', 'feedback-004'],
      },
      {
        name: 'Estimate clarity', sentiment: 'mixed',
        summary: 'Clear option-based estimates build trust while omitted fees and approvals trigger complaints.',
        supportingFeedbackIds: ['feedback-013', 'feedback-014', 'feedback-016', 'feedback-019'],
      },
      {
        name: 'Pickup quality control', sentiment: 'negative',
        summary: 'Small cleanliness and finish misses make the completed visit feel unfinished.',
        supportingFeedbackIds: ['feedback-031', 'feedback-032', 'feedback-033'],
      },
      {
        name: 'Technical trust', sentiment: 'positive',
        summary: 'Explanations, photos, and appropriate repair choices produce strong confidence in the shop.',
        supportingFeedbackIds: ['feedback-037', 'feedback-038', 'feedback-039', 'feedback-041'],
      },
    ],
  }
}

test('demo seed contains exactly 60 original, clearly synthetic feedback records', () => {
  const entries = createDemoFeedbackEntries(fixtureNow)
  assert.equal(entries.length, 60)
  assert.equal(new Set(entries.map(entry => entry.id)).size, 60)
  assert.equal(new Set(entries.map(entry => entry.text)).size, 60)
  assert.ok(entries.every(entry => /^feedback-\d{3}$/.test(entry.id)))
  assert.ok(entries.every(entry => entry.text.length >= 45))
  assert.ok(entries.every(entry => entry.rating >= 1 && entry.rating <= 5))
  assert.ok(entries.every(entry => entry.themes.length > 0))
  assert.equal(entries.some(entry => /amazon reviews 2023/i.test(entry.text)), false)
  assert.equal(entries.some(entry => /google review/i.test(entry.text)), false)
})

test('dashboard metrics are calculated from records and change with recovery and task state', () => {
  const state = createInitialFeedbackDemoState(fixtureNow)
  const initial = calculateFeedbackDemoMetrics(state, fixtureNow)
  const openIssue = state.feedback.find(entry => entry.requiresRecovery && entry.issueStatus !== 'resolved')
  assert.ok(openIssue)

  const changed = {
    ...state,
    feedback: state.feedback.map(entry => entry.id === openIssue.id
      ? { ...entry, issueStatus: 'resolved' as const, resolutionNote: 'Customer contacted and repair concern addressed.' }
      : entry),
    tasks: state.tasks.map((task, index) => index === 0 ? { ...task, status: 'done' as const } : task),
  }
  const updated = calculateFeedbackDemoMetrics(changed, fixtureNow)

  assert.equal(updated.totalFeedback, 60)
  assert.equal(updated.unresolvedIssues, initial.unresolvedIssues - 1)
  assert.equal(updated.resolvedIssues, initial.resolvedIssues + 1)
  assert.ok(updated.resolutionRate > initial.resolutionRate)
  assert.equal(updated.completedTasks, initial.completedTasks + 1)
  assert.equal(updated.sentiment.positive + updated.sentiment.neutral + updated.sentiment.negative, 60)
})

test('reset is repeatable and rejects incompatible persisted demo state', () => {
  const first = createInitialFeedbackDemoState(fixtureNow)
  const second = createInitialFeedbackDemoState(fixtureNow)
  assert.deepEqual(second, first)
  assert.equal(isFeedbackDemoState(first), true)
  assert.equal(isFeedbackDemoState({ ...first, version: FEEDBACK_DEMO_DATASET_VERSION + 1 }), false)
  assert.equal(isFeedbackDemoState({ ...first, feedback: first.feedback.slice(1) }), false)
})

test('AI findings retain only valid supporting records and distinct recommendations', () => {
  const entries = createDemoFeedbackEntries(fixtureNow)
  const analysis = normalizeFeedbackAnalysis(
    validRawAnalysis(),
    entries,
    '2026-11-15T19:00:00.000Z',
    'test-model'
  )

  assert.equal(analysis.findings.length, 3)
  assert.equal(analysis.themes.length, 4)
  assert.equal(analysis.findings[0].supportingFeedbackIds.includes('fabricated-id'), false)
  assert.ok(analysis.findings.every(finding => finding.supportingFeedbackIds.length >= 2))
  assert.equal(new Set(analysis.findings.map(finding => finding.recommendation)).size, 3)
  assert.ok(analysis.themes.every(theme => theme.supportingFeedbackIds.every(id => entries.some(entry => entry.id === id))))
  assert.equal(DEFAULT_FEEDBACK_DEMO_ANALYSIS.findings.length, 5)
  assert.equal(new Set(DEFAULT_FEEDBACK_DEMO_ANALYSIS.findings.map(finding => finding.recommendation)).size, 5)
  assert.ok(DEFAULT_FEEDBACK_DEMO_ANALYSIS.findings.every(finding => (
    finding.supportingFeedbackIds.length >= 2
    && finding.supportingFeedbackIds.every(id => entries.some(entry => entry.id === id))
  )))
})

test('different issue groups produce different analysis inputs and duplicate recommendations are rejected', () => {
  const entries = createDemoFeedbackEntries(fixtureNow)
  const communicationInput = buildFeedbackAnalysisInput(entries.slice(0, 6))
  const estimateInput = buildFeedbackAnalysisInput(entries.slice(12, 18))
  assert.notEqual(communicationInput, estimateInput)
  assert.match(communicationInput, /promised update window|without an update/i)
  assert.match(estimateInput, /final total|additional work/i)

  const duplicated = validRawAnalysis()
  duplicated.findings[1].recommendation = duplicated.findings[0].recommendation
  assert.throws(
    () => normalizeFeedbackAnalysis(duplicated, entries, fixtureNow.toISOString(), 'test-model'),
    /distinct, traceable recommendations/
  )
})

test('AI route is owner-scoped, same-origin, rate-limited, and canonical-demo-only', () => {
  const route = readFileSync('app/api/feedback-demo/analyze/route.ts', 'utf8')
  assert.match(route, /isSameOriginRequest\(request\)/)
  assert.match(route, /supabase\.auth\.getUser\(\)/)
  assert.match(route, /user\.email_confirmed_at/)
  assert.match(route, /\.eq\('id', workspaceId\)/)
  assert.match(route, /\.eq\('account_id', account\.id\)/)
  assert.match(route, /\.eq\('status', 'active'\)/)
  assert.match(route, /api_usage_log/)
  assert.match(route, /RATE_LIMIT = 4/)
  assert.match(route, /createDemoFeedbackEntries\(\)/)
  assert.doesNotMatch(route, /youtube|google|post-reply|publish/i)
})

test('demo UI persists isolated state and cannot call an external publishing route', () => {
  const client = readFileSync('app/dashboard/feedback-demo/FeedbackDemoClient.tsx', 'utf8')
  const page = readFileSync('app/dashboard/feedback-demo/page.tsx', 'utf8')
  const layout = readFileSync('app/dashboard/layout.tsx', 'utf8')
  const sidebar = readFileSync('app/dashboard/DashboardSidebar.tsx', 'utf8')
  const css = readFileSync('app/dashboard/feedback-demo/FeedbackDemo.module.css', 'utf8')
  const openai = readFileSync('lib/openai.ts', 'utf8')

  assert.match(client, /window\.localStorage/)
  assert.match(client, /createInitialFeedbackDemoState\(\)/)
  assert.match(client, /\/api\/feedback-demo\/analyze/)
  assert.match(client, /Save recovery update/)
  assert.match(client, /Create improvement task/)
  assert.match(client, /role="dialog"/)
  assert.match(client, /aria-modal="true"/)
  assert.match(client, /replova:close-assistant/)
  assert.match(client, /replova:close-feedback-recovery/)
  assert.match(client, /aria-expanded=\{isOpen\}/)
  assert.match(client, /id="feedback-priorities"/)
  assert.match(client, /id="customer-recovery"/)
  assert.match(client, /id="improvement-tasks"/)
  assert.match(client, /Nothing here can publish to Google, YouTube, or another external platform/)
  assert.doesNotMatch(client, /\/api\/(post-reply|youtube\/replies\/publish|sync-reviews)/)
  assert.match(page, /update\(`\$\{user\.id\}:\$\{workspace\.id\}:v1`\)/)
  assert.match(layout, /'\/dashboard\/feedback-demo'/)
  assert.match(sidebar, /Feedback demo/)
  assert.match(openai, /store: false/)
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.primaryGrid \{ grid-template-columns: 1fr; \}/)
  assert.match(css, /@media \(max-width: 440px\)/)
  assert.match(css, /\.recoveryDrawer/)
  assert.match(css, /overflow-wrap: anywhere/)
})

test('real review overview uses authorized workspace records without demo data', () => {
  const overview = readFileSync('app/dashboard/reviews/page.tsx', 'utf8')
  const css = readFileSync('app/dashboard/Overview.module.css', 'utf8')

  assert.match(overview, /\.from\('reviews'\)/)
  assert.match(overview, /Queue health/)
  assert.match(overview, /Live workspace data/)
  assert.match(overview, /Synthetic demo records stay isolated/)
  assert.doesNotMatch(overview, /createInitialFeedbackDemoState|createDemoFeedbackEntries/)
  assert.match(css, /@media \(max-width: 1120px\)/)
  assert.match(css, /@media \(max-width: 440px\)/)
})
