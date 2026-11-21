import { randomUUID } from 'node:crypto'
import {
  type ProviderAdapter,
  IntegrationNeeded,
  IncompleteResearch,
  outbound,
  validateReceipt,
  type Receipt,
} from './providers'
import {
  localDay,
  nextOperation,
  rankedQuotes,
  type Action,
  type Book,
  type RunState,
} from './workflow'

function applyReceipt(b: Book, a: Action, r: Receipt): RunState {
  const s = { ...b.state, pending: undefined }
  if (r.changed)
    return {
      ...s,
      issue: 'Provider terms changed. Review new written quotes and authorize again.',
      authorized: false,
      quotesComplete: false,
      quotes: [],
      change: undefined,
    }
  // A committed booking or cancellation must survive later settings edits or a pause.
  if (r.appointment) {
    const q = r.appointment.quote,
      expected = a.quote!
    const mismatch =
      q.totalCents !== expected.totalCents ||
      q.scope !== expected.scope ||
      q.terms !== expected.terms ||
      !q.allIn ||
      q.provider !== a.provider ||
      (a.op === 'book' && r.appointment.date !== expected.date) ||
      r.appointment.date < s.limits!.from ||
      r.appointment.date > s.limits!.until
    return {
      ...s,
      appointment: r.appointment,
      change: undefined,
      issue: mismatch
        ? 'Provider confirmation differs from authorized terms. Review the appointment.'
        : undefined,
    }
  }
  if (a.op === 'cancel')
    return {
      ...s,
      appointment: undefined,
      change: undefined,
      authorized: false,
      issue: 'Cancellation confirmed. Review limits before restarting.',
    }
  if (a.version !== s.version) {
    const was = a.constraints,
      current = s.limits
    if (!was || !current || was.scope !== current.scope || was.area !== current.area) return s
    if (a.op !== 'discover' && (was.from !== current.from || was.until !== current.until)) return s
  }
  if (r.providers)
    return {
      ...s,
      providers: r.providers,
      issue: r.providers.length
        ? undefined
        : 'No providers found. Adjust the scope or service area.',
    }
  if (a.op === 'outreach')
    return { ...s, contacted: [...new Set([...(s.contacted ?? []), a.provider!])] }
  if (r.quotes) {
    const next = { ...s, quotes: r.quotes, quotesComplete: r.complete }
    const best = rankedQuotes(next, localDay(b.snapshot.timezone))[0]
    if (r.complete && !best)
      next.issue = 'No eligible written quote. Review the budget, scope and service window.'
    if (best)
      next.comparison =
        s.limits?.preference === 'price'
          ? 'Lowest eligible all-in price within the service window.'
          : 'Earliest eligible visit within the all-in budget.'
    return next
  }
  return s
}
export async function executeRun(
  initial: Book,
  adapter: ProviderAdapter,
  read: (id: string) => Promise<Book | null>,
  transition: (
    book: Book,
    state: RunState,
    detail: Record<string, unknown>,
    delay?: number | null,
  ) => Promise<boolean>,
) {
  let b = initial
  let a = b.state.pending
  try {
    let receipt: Receipt
    if (a) {
      const result = await adapter.lookup(b, a)
      if (result === 'pending') {
        await transition(
          b,
          b.state,
          { status: 'Awaiting provider reconciliation', key: a.key },
          60000,
        )
        return
      }
      if (result === 'absent') {
        // The adapter certifies the original action cannot still commit.
        await transition(
          b,
          { ...b.state, pending: undefined, retry: a },
          { status: 'Confirmed no external action', key: a.key },
          b.state.paused ? null : 0,
        )
        return
      }
      receipt = result
    } else {
      const next = nextOperation(b.state, localDay(b.snapshot.timezone))
      if (!next) {
        await transition(
          b,
          {
            ...b.state,
            issue:
              b.state.issue ??
              (b.state.quotesComplete && !b.state.appointment && !b.state.paused
                ? 'Review quote eligibility and authorization.'
                : undefined),
          },
          { status: 'Waiting for owner' },
        )
        return
      }
      await adapter.check(next.op, b)
      a = {
        ...next,
        version: b.state.version!,
        constraints: b.state.limits,
        key:
          b.state.retry?.version === b.state.version &&
          b.state.retry?.op === next.op &&
          b.state.retry?.provider === next.provider &&
          b.state.retry?.quote?.id === next.quote?.id
            ? b.state.retry.key
            : randomUUID(),
      }
      const payload = outbound(b, a)
      if (
        !(await transition(
          b,
          {
            ...b.state,
            pending: a,
            retry: undefined,
            comparison:
              a.op === 'book'
                ? b.state.limits?.preference === 'price'
                  ? 'Lowest eligible all-in price within the service window.'
                  : 'Earliest eligible visit within the all-in budget.'
                : b.state.comparison,
          },
          { status: 'Prepared provider action', request: payload },
          60000,
        ))
      )
        return
      const current = await read(b.id)
      if (!current || current.state.pending?.key !== a.key) return
      b = current
      if (
        b.state.paused ||
        !b.state.authorized ||
        b.state.version !== a.version ||
        (a.op === 'book' &&
          rankedQuotes(b.state, localDay(b.snapshot.timezone))[0]?.id !== a.quote?.id)
      ) {
        await transition(
          b,
          { ...b.state, pending: undefined },
          { status: 'Authorization changed before dispatch' },
          b.state.paused ? null : 0,
        )
        return
      }
      receipt = await adapter.execute(b, a)
    }
    validateReceipt(a, receipt)
    const current = await read(b.id)
    if (!current || current.state.pending?.key !== a.key) return
    const state = applyReceipt(current, a, receipt)
    const due =
      state.paused || state.issue || state.appointment || !state.authorized
        ? null
        : a.op === 'quotes' && !receipt.complete
          ? 300000
          : 0
    await transition(
      current,
      state,
      { status: 'Provider result recorded', operation: a.op, key: a.key, receipt },
      due,
    )
  } catch (error) {
    const current = await read(b.id)
    if (!current || current.revision !== b.revision) return
    const op = a?.op ?? nextOperation(b.state, localDay(b.snapshot.timezone))?.op
    if (error instanceof IncompleteResearch) {
      await transition(
        current,
        { ...current.state, pending: undefined, issue: error.message },
        { status: error.message, operation: op },
      )
      return
    }
    if (current.state.pending) {
      await transition(
        current,
        current.state,
        { status: 'Outcome uncertain. Checking existing action before retry.', operation: op },
        60000,
      )
    } else {
      const issue =
        error instanceof IntegrationNeeded
          ? `${op}: ${error.message}`
          : `${op}: provider connection unavailable. Check the integration and resume.`
      await transition(current, { ...current.state, issue }, { status: issue })
    }
  }
}
