import { getSupabaseAdmin } from './supabase'
import { Resend } from 'resend'

const ALERT_EMAIL = process.env.DEV_ALERT_EMAIL ?? 'davidhsongg@gmail.com'

// Cost per token in USD
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  'claude-sonnet-4-20250514':  { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-sonnet-4-6':         { input: 3.00 / 1_000_000, output: 15.00 / 1_000_000 },
  'claude-opus-4-7':           { input: 15.00 / 1_000_000, output: 75.00 / 1_000_000 },
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS['claude-sonnet-4-20250514']
  return costs.input * inputTokens + costs.output * outputTokens
}

export async function recordUsage(
  model: string,
  operation: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const cost = calculateCost(model, inputTokens, outputTokens)
  const admin = getSupabaseAdmin()

  await Promise.all([
    (async () => {
    try {
      const { error } = await admin.from('api_usage_log')
        .insert({ model, operation, input_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost })
      if (error) throw error
    } catch (err) { console.error('[apiBudget] log insert failed:', err) }
    })(),

    // Atomically increment spend and check thresholds.
    (async () => {
    try {
      const { data, error } = await admin.rpc('increment_api_spend', { amount: cost })
      if (error || !data?.[0]) { console.error('[apiBudget] increment failed:', error); return }
      const row = data[0] as {
        new_spent_usd: number; budget_usd: number
        crossed_50: boolean; crossed_75: boolean; crossed_100: boolean
      }
      if (row.crossed_50)  await sendAlert(50,  row.new_spent_usd, row.budget_usd)
      if (row.crossed_75)  await sendAlert(75,  row.new_spent_usd, row.budget_usd)
      if (row.crossed_100) await sendAlert(100, row.new_spent_usd, row.budget_usd)
    } catch (err) { console.error('[apiBudget] increment failed:', err) }
    })(),
  ])
}

async function sendAlert(percent: number, spent: number, budget: number): Promise<void> {
  const remaining = Math.max(0, budget - spent)
  const emoji = percent >= 100 ? '🚨' : percent >= 75 ? '⚠️' : '📊'
  const label = percent >= 100 ? 'BUDGET EXHAUSTED' : `${percent}% used`

  const resend = new Resend(process.env.RESEND_API_KEY)
  const from = process.env.RESEND_FROM_EMAIL ?? 'alerts@replova.com'

  await resend.emails.send({
    from,
    to: ALERT_EMAIL,
    subject: `${emoji} Replova API budget ${label} — $${spent.toFixed(2)} / $${budget.toFixed(2)}`,
    html: `
<h2 style="margin:0 0 16px">${emoji} API Budget Alert</h2>
<table style="border-collapse:collapse;font-family:monospace;font-size:14px">
  <tr><td style="padding:4px 16px 4px 0;color:#666">Spent</td>
      <td style="padding:4px 0"><strong>$${spent.toFixed(4)}</strong></td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666">Budget</td>
      <td style="padding:4px 0"><strong>$${budget.toFixed(2)}</strong></td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666">Remaining</td>
      <td style="padding:4px 0"><strong>$${remaining.toFixed(4)}</strong></td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#666">Used</td>
      <td style="padding:4px 0"><strong>${((spent / budget) * 100).toFixed(1)}%</strong></td></tr>
</table>
${percent >= 100
  ? '<p style="margin-top:16px;color:#c00"><strong>🚨 Budget exhausted. Increase DEV_BUDGET_USD or top up your Anthropic balance.</strong></p>'
  : ''}
    `.trim(),
  }).catch(err => console.error('[apiBudget] alert email failed:', err))
}
