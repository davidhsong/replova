import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveredRate, sampleCampaign } from '../lib/sampleCampaign'

test('sample campaign uses delivered contacts for both engagement rates', () => {
  assert.equal(deliveredRate(sampleCampaign.clicked, sampleCampaign.delivered), '31.1%')
  assert.equal(deliveredRate(sampleCampaign.opened, sampleCampaign.delivered), '72.7%')
  assert.equal(deliveredRate(0, 0), '0.0%')
})
