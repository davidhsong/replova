import type { ProviderAdapter, Receipt } from './providers'
import type { Action, Book, Quote } from './workflow'

// Deterministic receipts, exclusively selected by the immutable test flag on a saved run.
function simulate(book: Book, a: Action): Receipt {
  if (!book.is_test) throw new Error('Sample adapter requires a test Playbook')
  const l = book.state.limits!
  const providers = ['A', 'B'].map((id) => ({
    id,
    name: 'Sample service ' + id,
    url: 'https://example.invalid/provider-' + id,
    area: l.area,
    fit: l.scope,
    estimate: 'Sample estimate · $100 to $220',
  }))
  const quotes: Quote[] = providers.map((p, i) => ({
    id: 'sample-' + a.version + '-' + p.id,
    provider: p.id,
    totalCents: 12500 + i * 5400,
    currency: 'USD',
    date: l.from,
    scope: l.scope,
    terms: 'One scheduled visit, taxes and fees included.',
    validUntil: l.until + 'T23:59:59Z',
    reference: 'Sample written quote ' + p.id,
    allIn: true,
  }))
  switch (a.op) {
    case 'discover':
      return { providers }
    case 'outreach':
      return {
        reference: 'sample-' + a.key,
        message: 'Sample written quote requested for ' + l.scope,
      }
    case 'quotes':
      return { quotes, complete: true }
    case 'cancel':
      return { reference: 'sample-' + a.key, message: 'Sample cancellation confirmed' }
    case 'book':
    case 'reschedule':
      return {
        appointment: {
          reference: 'sample-' + a.key,
          date: a.op === 'reschedule' ? l.from : a.quote!.date,
          provider: a.provider!,
          quote: a.quote!,
        },
      }
  }
}
export const testAdapter: ProviderAdapter = {
  check: async () => {},
  execute: async (b, a) => simulate(b, a),
  lookup: async (b, a) => simulate(b, a),
}
