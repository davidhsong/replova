export const flowLabels = {
  total: 'Submissions received',
  written: 'With a comment',
  rating: 'Rating only',
  issue: 'Issue reported',
  clear: 'No issue identified',
  pending: 'Analysis pending',
  unavailable: 'Analysis unavailable',
  urgent: 'Urgent',
  other: 'Other issue reports',
} as const
export type FlowKey = keyof typeof flowLabels
type Leaf = Exclude<FlowKey, 'total' | 'written' | 'issue'>
export type LeafCounts = Partial<Record<Leaf, number>>
export function flowKey(value?: string): FlowKey | null {
  return value && Object.hasOwn(flowLabels, value) ? (value as FlowKey) : null
}
export function flowCounts(leaves: LeafCounts): Record<FlowKey, number> {
  const { rating = 0, urgent = 0, other = 0, clear = 0, pending = 0, unavailable = 0 } = leaves
  const issue = urgent + other
  const written = issue + clear + pending + unavailable
  return {
    total: written + rating,
    written,
    issue,
    urgent,
    other,
    clear,
    rating,
    pending,
    unavailable,
  }
}
export const flowParent: Partial<Record<FlowKey, FlowKey>> = {
  written: 'total',
  rating: 'total',
  issue: 'written',
  clear: 'written',
  pending: 'written',
  unavailable: 'written',
  urgent: 'issue',
  other: 'issue',
}
