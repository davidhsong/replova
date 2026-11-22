// Pure local simulation. Only the service criteria and opaque Playbook ID enter this adapter.
export type Criteria = {
  scope: string
  maxCents: number
  from: string
  until: string
  preference: string
}
type Option = { id: string; name: string }
type Terms = Option & {
  scope: string
  totalCents: number
  available: string
  exclusions: string
  allIn: boolean
}
type Decision = Terms & { reason: string }
export type IssueState = {
  route: 'facilities' | 'internal' | 'safety'
  stage:
    | 'owner'
    | 'discovery'
    | 'quotes'
    | 'selection'
    | 'schedule'
    | 'reconcile'
    | 'evaluate'
    | 'completed'
    | 'attention'
  nextAction: string
  criteria?: Criteria
  task?: string
  providers?: Option[]
  quotes?: Terms[]
  decisions?: Decision[]
  selected?: Decision
  bookingKey?: string
  appointment?: { reference: string; provider: string; date: string; totalCents: number }
}
export type Step = { state: IssueState; status: string; summary: string }
export function compareTerms(quotes: Terms[], criteria: Criteria) {
  const reviewed = quotes.map((q) => {
    let reason = ''
    if (
      !q.allIn ||
      !q.scope ||
      !q.exclusions ||
      !q.available ||
      !Number.isSafeInteger(q.totalCents) ||
      q.totalCents <= 0
    )
      reason = 'Missing written terms or all-in price.'
    else if (q.scope !== criteria.scope) reason = 'Scope differs from the requested work.'
    else if (q.totalCents > criteria.maxCents) reason = 'Exceeds the simulated service budget.'
    else if (q.available < criteria.from || q.available > criteria.until)
      reason = 'Outside the service window.'
    return { ...q, reason }
  })
  const eligible = reviewed
    .filter((q) => !q.reason)
    .sort(
      (a, b) =>
        a.totalCents - b.totalCents ||
        a.available.localeCompare(b.available) ||
        a.id.localeCompare(b.id),
    )
  const selected = eligible[0]
  for (const q of eligible)
    q.reason =
      q === selected
        ? 'Selected for the lowest qualifying all-in price, with availability inside the window.'
        : 'Qualifies, ranked behind the selected option by price and availability.'
  return { decisions: reviewed, selected }
}
export function simulatedBooking(key: string, quote: Decision) {
  return {
    reference: key,
    provider: quote.name,
    date: quote.available,
    totalCents: quote.totalCents,
  }
}
type BookingResult = ReturnType<typeof simulatedBooking> | 'failed' | 'uncertain'
export function simulationStep(
  id: string,
  s: IssueState,
  lookup: (key: string, quote: Decision) => BookingResult = simulatedBooking,
): Step | null {
  const c = s.criteria
  if (s.route !== 'facilities' || !c) return null
  function step(status: string, summary: string, next: Partial<IssueState>): Step {
    return { status, summary, state: { ...s, ...next } }
  }
  switch (s.stage) {
    case 'discovery': {
      const providers = [
        { id: 'a', name: 'Sample Facilities A' },
        { id: 'b', name: 'Sample Facilities B' },
        { id: 'c', name: 'Sample Facilities C' },
      ]
      return step(
        'Simulation · Provider comparison',
        'Three synthetic facilities providers cover the requested scope.',
        { providers, stage: 'quotes', nextAction: 'Generate simulated written quotes.' },
      )
    }
    case 'quotes': {
      const quotes = (s.providers ?? []).map((p, i) => ({
        ...p,
        scope: c.scope,
        totalCents: [14500, 17900, 23500][i],
        available: i === 1 ? c.until : c.from,
        exclusions: 'Replacement parts and additional visits excluded.',
        allIn: true,
      }))
      return step(
        'Simulation · Written quotes',
        'Generated comparable USD terms for one service visit, including labor and fees.',
        {
          quotes,
          stage: 'selection',
          nextAction: 'Check scope, availability and price against the saved criteria.',
        },
      )
    }
    case 'selection': {
      const result = compareTerms(s.quotes ?? [], c)
      const nextAction = result.selected
        ? 'Schedule the qualifying simulated service.'
        : 'Review the rejected terms and record the next owner action.'
      return step(
        'Simulation · Quote decision',
        result.selected
          ? 'One written quote was selected under the recorded service criteria.'
          : 'No option met the recorded criteria.',
        {
          ...result,
          stage: result.selected ? 'schedule' : 'attention',
          bookingKey: result.selected ? 'SIM-' + id : undefined,
          nextAction,
        },
      )
    }
    case 'schedule':
    case 'reconcile': {
      if (!s.bookingKey || !s.selected)
        return step('Simulation · Booking unavailable', 'Missing quote or booking reference.', {
          stage: 'attention',
          nextAction: 'Review the quote decision.',
        })
      const result = lookup(s.bookingKey, s.selected)
      if (result === 'uncertain')
        return step(
          'Simulation · Confirmation pending',
          'Recheck the same simulation reference before continuing.',
          {
            stage: 'reconcile',
            nextAction: 'Await confirmation of the original simulation reference.',
          },
        )
      if (result === 'failed')
        return step(
          'Simulation · Booking failed',
          'The simulator could not confirm an appointment.',
          { stage: 'attention', nextAction: 'Review the failed booking and the selected terms.' },
        )
      return step(
        'Simulation · Appointment',
        'The local simulator confirmed one appointment under the selected terms.',
        {
          appointment: result,
          stage: 'evaluate',
          nextAction: 'Evaluate the simulated service receipt.',
        },
      )
    }
    case 'evaluate': {
      const a = s.appointment,
        q = s.selected
      if (
        !a ||
        !q ||
        a.reference !== s.bookingKey ||
        a.date !== q.available ||
        a.totalCents !== q.totalCents ||
        a.provider !== q.name
      )
        return step(
          'Simulation · Outcome needs review',
          'The confirmation differs from the selected terms.',
          { stage: 'attention', nextAction: 'Inspect the confirmation and selected quote.' },
        )
      return step(
        'Simulation · Simulated service completed',
        'The simulated receipt matches the selected provider, appointment and price.',
        {
          stage: 'completed',
          nextAction: 'Monitor new feedback and record any real corrective work.',
        },
      )
    }
    default:
      return null
  }
}
