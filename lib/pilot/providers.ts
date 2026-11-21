import {
  isoDay,
  type Action,
  type Appointment,
  type Book,
  type Provider,
  type Quote,
} from './workflow'

export type Receipt = {
  providers?: Provider[]
  quotes?: Quote[]
  complete?: boolean
  reference?: string
  message?: string
  appointment?: Appointment
  changed?: boolean
}
export class IncompleteResearch extends Error {}
export class IntegrationNeeded extends Error {}
export type ProviderAdapter = {
  check: (op: Action['op'], book: Book) => Promise<void>
  execute: (book: Book, action: Action) => Promise<Receipt>
  lookup: (book: Book, action: Action) => Promise<Receipt | 'absent' | 'pending'>
}
const textValue = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= 4000
function officialUrl(v: unknown) {
  if (!textValue(v)) return false
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}
export function validQuote(q: Quote) {
  return (
    q &&
    textValue(q.id) &&
    textValue(q.provider) &&
    Number.isSafeInteger(q.totalCents) &&
    q.totalCents >= 0 &&
    q.currency === 'USD' &&
    isoDay(q.date) &&
    Number.isFinite(Date.parse(q.validUntil)) &&
    textValue(q.scope) &&
    textValue(q.terms) &&
    textValue(q.reference) &&
    typeof q.allIn === 'boolean'
  )
}
export function validateReceipt(a: Action, r: Receipt) {
  if (
    r.changed === true &&
    (a.op === 'book' || a.op === 'reschedule') &&
    !r.appointment &&
    textValue(r.message)
  )
    return r
  if (
    a.op === 'discover' &&
    Array.isArray(r.providers) &&
    r.providers.length <= 10 &&
    r.providers.every(
      (p) =>
        p &&
        textValue(p.id) &&
        textValue(p.name) &&
        officialUrl(p.url) &&
        textValue(p.fit) &&
        textValue(p.area) &&
        typeof p.estimate === 'string',
    ) &&
    new Set(r.providers.map((p) => p.id)).size === r.providers.length
  )
    return r
  if (
    a.op === 'quotes' &&
    typeof r.complete === 'boolean' &&
    Array.isArray(r.quotes) &&
    r.quotes.length <= 100 &&
    r.quotes.every(validQuote)
  )
    return r
  if ((a.op === 'outreach' || a.op === 'cancel') && textValue(r.reference) && textValue(r.message))
    return r
  if (
    (a.op === 'book' || a.op === 'reschedule') &&
    r.appointment &&
    validQuote(r.appointment.quote) &&
    textValue(r.appointment.reference) &&
    isoDay(r.appointment.date) &&
    r.appointment.provider === a.provider
  )
    return r
  if (a.op === 'quotes')
    throw new IncompleteResearch(
      'Written quote missing a verified source, all-in price, service date, scope or terms. Ask the channel for a complete quote, then resume.',
    )
  if (a.op === 'discover')
    throw new IncompleteResearch(
      'Provider research is missing a valid source or service area. Check the discovery integration and resume.',
    )
  throw new Error('Provider confirmation is incomplete')
}

// A gateway must durably deduplicate keys, support authoritative lookup, and condition booking on exact terms.
async function gateway(path: string, options: RequestInit = {}) {
  const base = process.env.PILOT_PROVIDER_URL
  const secret = process.env.PILOT_PROVIDER_TOKEN
  if (!base?.startsWith('https://') || !secret)
    throw new IntegrationNeeded(
      'Configure the provider gateway URL and token in Provider integrations.',
    )
  const res = await fetch(base.replace(/\/$/, '') + path, {
    ...options,
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error('Provider gateway unavailable')
  return res.json()
}

export function outbound(b: Book, a: Action) {
  const l = b.state.limits!
  // Provider-visible data excludes visitor comments, owner notes, and the owner's budget.
  return {
    operation: a.op,
    run: b.id,
    key: a.key,
    provider: a.provider,
    scope: l.scope,
    serviceArea: l.area,
    window: { from: l.from, until: l.until, timezone: b.snapshot.timezone },
    ...(a.op === 'quotes' ? { providers: b.state.contacted } : {}),
    ...(a.quote ? { exactQuote: a.quote } : {}),
    ...(b.state.appointment ? { appointmentReference: b.state.appointment.reference } : {}),
  }
}
function requirePilot(book: Book) {
  if (
    book.is_test ||
    process.env.PILOT_PROVIDER_LIVE !== 'true' ||
    book.location_id !== process.env.PILOT_PROVIDER_LOCATION_ID
  ) {
    throw new IntegrationNeeded(
      'Enable the verified provider channel for this pilot location in Provider integrations.',
    )
  }
}
export const liveAdapter: ProviderAdapter = {
  async check(op, book) {
    if (op === 'discover' && process.env.GOOGLE_PLACES_API_KEY) return
    requirePilot(book)
    const caps = await gateway('/capabilities')
    if (
      caps.verified !== true ||
      caps.idempotency !== true ||
      caps.reconciliation !== true ||
      caps.conditionalBooking !== true ||
      !Array.isArray(caps.operations) ||
      !caps.operations.includes(op)
    )
      throw new IntegrationNeeded(`Provider integration needs verified support for ${op}.`)
  },
  async execute(book, action) {
    if (action.op === 'discover' && process.env.GOOGLE_PLACES_API_KEY) {
      const { searchNearbyPlaces, getPlaceDetails } = await import('@/lib/places')
      const l = book.state.limits!
      const matches = await searchNearbyPlaces(`${l.scope} service providers near ${l.area}`)
      const providers = await Promise.all(
        matches.slice(0, 3).map(async (p) => {
          const place = await getPlaceDetails(p.placeId)
          return {
            id: p.placeId,
            name: p.name,
            area: p.address || l.area,
            fit: (place.primaryType ?? 'Local search match').replaceAll('_', ' '),
            url: officialUrl(place.website)
              ? place.website!
              : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${encodeURIComponent(p.placeId)}`,
            estimate: 'Written quote needed',
          }
        }),
      )
      return { providers }
    }
    requirePilot(book)
    return validateReceipt(
      action,
      await gateway('/actions', {
        method: 'POST',
        headers: { 'Idempotency-Key': action.key },
        body: JSON.stringify(outbound(book, action)),
      }),
    )
  },
  async lookup(book, action) {
    if (action.op === 'discover' && process.env.GOOGLE_PLACES_API_KEY) return 'absent'
    const result = await gateway('/actions/' + encodeURIComponent(action.key))
    if (result.status === 'absent' || result.status === 'pending') return result.status
    if (result.status !== 'confirmed') throw new Error('Awaiting verified outcome')
    return validateReceipt(action, result.receipt)
  },
}
