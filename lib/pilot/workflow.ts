export type Provider = {
  id: string
  name: string
  url: string
  area: string
  fit: string
  estimate: string
}
export type Limits = {
  scope: string
  area: string
  maxCents: number
  from: string
  until: string
  preference: 'price' | 'earliest'
}
export type Quote = {
  id: string
  provider: string
  totalCents: number
  currency: 'USD'
  date: string
  scope: string
  terms: string
  validUntil: string
  reference: string
  allIn: boolean
}
export type Operation = 'discover' | 'outreach' | 'quotes' | 'book' | 'cancel' | 'reschedule'
export type Action = {
  op: Operation
  key: string
  version: number
  constraints?: Limits
  provider?: string
  quote?: Quote
}
export type Appointment = { reference: string; date: string; provider: string; quote: Quote }
export type RunState = {
  notes?: string
  kind?: 'external' | 'internal'
  limits?: Limits
  version?: number
  authorized?: boolean
  paused?: boolean
  providers?: Provider[]
  contacted?: string[]
  quotes?: Quote[]
  retry?: Action
  pending?: Action
  issue?: string
  appointment?: Appointment
  change?: 'cancel' | 'reschedule'
  resolved?: boolean
  followUp?: string
  verified?: string
  quotesComplete?: boolean
  internalDone?: boolean
  comparison?: string
  startedAt?: string
}
export type Book = {
  id: string
  location_id: string
  theme: string
  is_test: boolean
  revision: number
  focus?: string
  quarter_start: string
  snapshot: {
    timezone: string
    start: string
    endExclusive: string
    captured: string
    total: number
    evidence: { id: string; excerpt: string; at: string }[]
  }
  state: RunState
}
export const isoDay = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value
export function localDay(zone: string, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
export function rankedQuotes(state: RunState, day: string, now = Date.now()) {
  const l = state.limits
  if (!l) return []
  return (state.quotes ?? [])
    .filter(
      (q) =>
        q.allIn &&
        q.currency === 'USD' &&
        q.totalCents <= l.maxCents &&
        q.scope === l.scope &&
        q.date >= day &&
        q.date >= l.from &&
        q.date <= l.until &&
        Date.parse(q.validUntil) > now &&
        q.reference &&
        q.terms &&
        state.providers?.some((p) => p.id === q.provider),
    )
    .sort(
      (a, b) =>
        (l.preference === 'earliest'
          ? a.date.localeCompare(b.date) || a.totalCents - b.totalCents
          : a.totalCents - b.totalCents || a.date.localeCompare(b.date)) ||
        a.id.localeCompare(b.id),
    )
}
export function nextOperation(s: RunState, day: string): Omit<Action, 'key' | 'version'> | null {
  if (s.paused || s.resolved || !s.authorized || s.kind !== 'external' || !s.limits || s.issue)
    return null
  if (s.change && s.appointment)
    return { op: s.change, provider: s.appointment.provider, quote: s.appointment.quote }
  if (s.appointment) return null
  if (!s.providers) return { op: 'discover' }
  const provider = s.providers.find((p) => !s.contacted?.includes(p.id))
  if (provider) return { op: 'outreach', provider: provider.id }
  if (!s.quotesComplete) return { op: 'quotes' }
  const best = rankedQuotes(s, day)[0]
  return best ? { op: 'book', provider: best.provider, quote: best } : null
}
export function stepIndex(s: RunState) {
  if (!s.notes || !s.kind) return 0
  if (s.kind === 'internal') return s.internalDone ? 4 : 1
  if (!s.providers?.length || !s.limits) return 1
  if (!s.quotesComplete) return 2
  return s.appointment && !s.change ? 4 : 3
}
export function statusText(s: RunState) {
  if (s.pending && s.paused) return 'Paused · checking the last provider action'
  if (s.paused) return 'Paused by owner'
  if (s.issue) return s.issue
  if (s.resolved) return 'Fix verified'
  if (s.pending) return 'Checking provider activity'
  if (s.change) return s.change === 'cancel' ? 'Cancellation requested' : 'Reschedule requested'
  if (s.appointment) return 'Booking confirmed'
  if (!s.notes) return 'Log what happened'
  if (s.kind === 'internal') return s.internalDone ? 'Verify the fix' : 'Complete the internal task'
  if (!s.authorized) return 'Set limits and authorize this run'
  return [
    'Log what happened',
    'Finding providers',
    'Collecting written quotes',
    'Confirming service',
    'Verify the fix',
  ][stepIndex(s)]
}
export function reviseLimits(s: RunState, limits: Limits) {
  const previous = s.limits
  const discoveryChanged =
    !previous || previous.area !== limits.area || previous.scope !== limits.scope
  const datesChanged = previous?.from !== limits.from || previous?.until !== limits.until
  const next: RunState = {
    ...s,
    limits,
    version: (s.version ?? 0) + 1,
    authorized: true,
    issue: undefined,
    comparison: undefined,
  }
  if (!s.appointment && discoveryChanged) {
    next.providers = undefined
    next.contacted = []
    next.quotes = []
    next.quotesComplete = false
  } else if (!s.appointment && datesChanged) {
    next.contacted = []
    next.quotes = []
    next.quotesComplete = false
  }
  return {
    next,
    reason: s.appointment
      ? 'Updated limits. Existing appointment retained.'
      : discoveryChanged
        ? 'Recheck service area and scope, then request matching quotes.'
        : datesChanged
          ? 'Reuse provider research and request updated availability.'
          : 'Reuse written quotes and recalculate eligibility and ranking.',
  }
}
