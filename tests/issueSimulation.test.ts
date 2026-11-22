import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareTerms,
  simulatedBooking,
  simulationStep,
  type IssueState,
} from '../lib/pilot/issueSimulation'

const criteria = {
  scope: 'Inspect fixtures',
  maxCents: 20000,
  from: '2026-12-01',
  until: '2026-12-08',
  preference: 'Lowest qualifying all-in price, then earliest availability',
}
const start: IssueState = {
  route: 'facilities',
  stage: 'discovery',
  criteria,
  nextAction: 'Inspect',
}
test('saved local simulation handles incomplete terms, budget rejection, failed and uncertain booking', () => {
  const providers = simulationStep('local', start)!.state
  const terms = simulationStep('local', providers)!.state
  const compared = simulationStep('local', terms)!.state
  assert.equal(compared.selected?.name, 'Sample Facilities A')
  assert.match(compared.decisions![2].reason, /budget/)
  const rejected = compareTerms(
    terms.quotes!.map((q) => ({ ...q, exclusions: '' })),
    criteria,
  )
  assert.ok(rejected.decisions.every((q) => q.reason.includes('Missing')))
  assert.equal(rejected.selected, undefined)
  assert.equal(
    simulationStep('local', { ...terms, criteria: { ...criteria, maxCents: 1 } })!.state.stage,
    'attention',
  )
  const failed = simulationStep('local', compared, () => 'failed')!.state
  assert.equal(failed.stage, 'attention')
  assert.equal(failed.appointment, undefined)
  const keys: string[] = []
  const uncertain = simulationStep('local', compared, (k) => {
    keys.push(k)
    return 'uncertain'
  })!.state
  assert.equal(uncertain.stage, 'reconcile')
  const confirmed = simulationStep('local', JSON.parse(JSON.stringify(uncertain)), (key, q) => {
    keys.push(key)
    return simulatedBooking(key, q)
  })!.state
  assert.deepEqual(keys, ['SIM-local', 'SIM-local'])
  assert.equal(simulationStep('local', confirmed)!.state.stage, 'completed')
  assert.equal(
    simulationStep('local', {
      ...confirmed,
      appointment: { ...confirmed.appointment!, totalCents: 1 },
    })!.state.stage,
    'attention',
  )
  assert.equal(simulationStep('local', { ...start, route: 'safety' }), null)
  assert.equal(simulationStep('local', { ...start, route: 'internal' }), null)
})
