import type { PlaybookProposal } from '@/lib/playbook'

export type DiffSegment = {
  text: string
  changed: boolean
}

export type ProcedureStepChange =
  | {
      kind: 'added'
      after: string
      afterIndex: number
    }
  | {
      kind: 'removed'
      before: string
      beforeIndex: number
    }
  | {
      kind: 'moved'
      text: string
      beforeIndex: number
      afterIndex: number
    }
  | {
      kind: 'changed'
      before: string
      after: string
      beforeIndex: number
      afterIndex: number
      beforeSegments: DiffSegment[]
      afterSegments: DiffSegment[]
    }

export type ProcedureStepComparison = {
  identical: boolean
  unchangedCount: number
  changes: ProcedureStepChange[]
}

function longestCommonSubsequencePairs<T>(
  before: readonly T[],
  after: readonly T[],
  equal: (left: T, right: T) => boolean,
) {
  const lengths = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  )

  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] = equal(before[left], after[right])
        ? lengths[left + 1][right + 1] + 1
        : Math.max(lengths[left + 1][right], lengths[left][right + 1])
    }
  }

  const pairs: Array<[number, number]> = []
  let left = 0
  let right = 0
  while (left < before.length && right < after.length) {
    if (equal(before[left], after[right])) {
      pairs.push([left, right])
      left += 1
      right += 1
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      left += 1
    } else {
      right += 1
    }
  }
  return pairs
}

function comparisonWords(value: string) {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) ?? []
}

function wordSimilarity(before: string, after: string) {
  const beforeWords = comparisonWords(before)
  const afterWords = comparisonWords(after)
  if (beforeWords.length === 0 || afterWords.length === 0) return 0
  const matches = longestCommonSubsequencePairs(
    beforeWords,
    afterWords,
    (left, right) => left === right,
  ).length
  return (2 * matches) / (beforeWords.length + afterWords.length)
}

function characterBigramSimilarity(before: string, after: string) {
  const normalize = (value: string) =>
    value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
  const left = normalize(before)
  const right = normalize(after)
  if (left.length < 2 || right.length < 2) return 0

  const bigrams = (value: string) => {
    const result = new Set<string>()
    for (let index = 0; index < value.length - 1; index += 1) {
      result.add(value.slice(index, index + 2))
    }
    return result
  }
  const leftBigrams = bigrams(left)
  const rightBigrams = bigrams(right)
  let overlap = 0
  leftBigrams.forEach((bigram) => {
    if (rightBigrams.has(bigram)) overlap += 1
  })
  return (2 * overlap) / (leftBigrams.size + rightBigrams.size)
}

function stepSimilarity(before: string, after: string) {
  return Math.max(
    wordSimilarity(before, after),
    characterBigramSimilarity(before, after),
  )
}

function tokenizeForDisplay(value: string) {
  return (
    value.match(/\s+|[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s\p{L}\p{N}]/gu) ??
    [value]
  )
}

function mergeSegments(tokens: string[], unchanged: Set<number>): DiffSegment[] {
  const segments: DiffSegment[] = []
  tokens.forEach((text, index) => {
    const changed = text.trim().length > 0 && !unchanged.has(index)
    const previous = segments.at(-1)
    if (previous && previous.changed === changed) previous.text += text
    else segments.push({ text, changed })
  })
  return segments
}

function compareWording(before: string, after: string) {
  const beforeTokens = tokenizeForDisplay(before)
  const afterTokens = tokenizeForDisplay(after)
  const pairs = longestCommonSubsequencePairs(
    beforeTokens,
    afterTokens,
    (left, right) => left.toLocaleLowerCase() === right.toLocaleLowerCase(),
  )
  return {
    beforeSegments: mergeSegments(
      beforeTokens,
      new Set(pairs.map(([index]) => index)),
    ),
    afterSegments: mergeSegments(
      afterTokens,
      new Set(pairs.map(([, index]) => index)),
    ),
  }
}

/**
 * Compares procedure steps without treating every wording edit as unrelated.
 * Exact sequence matches are omitted, exact reorders are reported as moves,
 * and wording changes are paired only when each side is the other's unique,
 * high-confidence match. Ambiguous edits deliberately fall back to separate
 * additions and removals so a material change is never hidden.
 */
export function compareProcedureSteps(
  before: readonly string[],
  after: readonly string[],
): ProcedureStepComparison {
  const identical =
    before.length === after.length &&
    before.every((step, index) => step === after[index])
  if (identical) {
    return { identical: true, unchangedCount: before.length, changes: [] }
  }

  const exactPairs = longestCommonSubsequencePairs(
    before,
    after,
    (left, right) => left === right,
  )
  const matchedBefore = new Set(exactPairs.map(([index]) => index))
  const matchedAfter = new Set(exactPairs.map(([, index]) => index))
  const changes: ProcedureStepChange[] = []

  // Exact matches left outside the common sequence are genuine reorders.
  before.forEach((step, beforeIndex) => {
    if (matchedBefore.has(beforeIndex)) return
    const afterIndex = after.findIndex(
      (candidate, index) => !matchedAfter.has(index) && candidate === step,
    )
    if (afterIndex < 0) return
    matchedBefore.add(beforeIndex)
    matchedAfter.add(afterIndex)
    changes.push({ kind: 'moved', text: step, beforeIndex, afterIndex })
  })

  type Candidate = { beforeIndex: number; afterIndex: number; score: number }
  const candidates: Candidate[] = []
  before.forEach((beforeStep, beforeIndex) => {
    if (matchedBefore.has(beforeIndex)) return
    after.forEach((afterStep, afterIndex) => {
      if (matchedAfter.has(afterIndex)) return
      candidates.push({
        beforeIndex,
        afterIndex,
        score: stepSimilarity(beforeStep, afterStep),
      })
    })
  })

  const rankedForBefore = (beforeIndex: number) =>
    candidates
      .filter((candidate) => candidate.beforeIndex === beforeIndex)
      .sort((left, right) => right.score - left.score)
  const rankedForAfter = (afterIndex: number) =>
    candidates
      .filter((candidate) => candidate.afterIndex === afterIndex)
      .sort((left, right) => right.score - left.score)

  candidates
    .sort((left, right) => right.score - left.score)
    .forEach((candidate) => {
      if (
        candidate.score < 0.58 ||
        matchedBefore.has(candidate.beforeIndex) ||
        matchedAfter.has(candidate.afterIndex)
      )
        return
      const beforeRanking = rankedForBefore(candidate.beforeIndex)
      const afterRanking = rankedForAfter(candidate.afterIndex)
      if (
        beforeRanking[0] !== candidate ||
        afterRanking[0] !== candidate ||
        (beforeRanking[1] && candidate.score - beforeRanking[1].score < 0.08) ||
        (afterRanking[1] && candidate.score - afterRanking[1].score < 0.08)
      )
        return

      matchedBefore.add(candidate.beforeIndex)
      matchedAfter.add(candidate.afterIndex)
      changes.push({
        kind: 'changed',
        before: before[candidate.beforeIndex],
        after: after[candidate.afterIndex],
        beforeIndex: candidate.beforeIndex,
        afterIndex: candidate.afterIndex,
        ...compareWording(
          before[candidate.beforeIndex],
          after[candidate.afterIndex],
        ),
      })
    })

  before.forEach((step, beforeIndex) => {
    if (!matchedBefore.has(beforeIndex)) {
      changes.push({ kind: 'removed', before: step, beforeIndex })
    }
  })
  after.forEach((step, afterIndex) => {
    if (!matchedAfter.has(afterIndex)) {
      changes.push({ kind: 'added', after: step, afterIndex })
    }
  })

  changes.sort((left, right) => {
    const anchor = (change: ProcedureStepChange) =>
      'afterIndex' in change ? change.afterIndex : change.beforeIndex + 0.5
    return anchor(left) - anchor(right)
  })

  return {
    identical: false,
    unchangedCount: exactPairs.length,
    changes,
  }
}

export function actionablePlaybookProposals<
  T extends Pick<PlaybookProposal, 'status'>,
>(proposals: readonly T[]): T[] {
  return proposals.filter(
    (proposal) =>
      proposal.status === 'pending' || proposal.status === 'approved',
  )
}
