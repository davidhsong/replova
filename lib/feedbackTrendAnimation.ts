export type TrendAnimationPoint = {
  x: number
  y: number
}

export type TrendAnimationStage =
  | {
      type: 'pause'
      startMs: number
      endMs: number
      vertexIndex: number
      length: number
    }
  | {
      type: 'move'
      startMs: number
      endMs: number
      fromVertexIndex: number
      toVertexIndex: number
      fromLength: number
      toLength: number
    }

export type TrendAnimationTimeline = {
  cumulativeLengths: number[]
  stages: TrendAnimationStage[]
  totalLength: number
  totalDurationMs: number
}

export type TrendAnimationFrame = {
  complete: boolean
  length: number
  marker: TrendAnimationPoint
  pausedVertexIndex: number | null
  reachedVertexIndex: number
}

export const TREND_INITIAL_PAUSE_MS = 180
export const TREND_MOVE_MS = 400
export const TREND_VERTEX_PAUSE_MS = 180
export const TREND_FINAL_HOLD_MS = 320

function distance(a: TrendAnimationPoint, b: TrendAnimationPoint) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

export function createFeedbackTrendTimeline(
  points: readonly TrendAnimationPoint[],
): TrendAnimationTimeline {
  if (points.length < 2) {
    throw new Error('Feedback trend animation requires at least two points.')
  }

  const cumulativeLengths = [0]
  for (let index = 1; index < points.length; index += 1) {
    cumulativeLengths.push(
      cumulativeLengths[index - 1] + distance(points[index - 1], points[index]),
    )
  }

  const stages: TrendAnimationStage[] = []
  let cursor = 0

  stages.push({
    type: 'pause',
    startMs: cursor,
    endMs: cursor + TREND_INITIAL_PAUSE_MS,
    vertexIndex: 0,
    length: 0,
  })
  cursor += TREND_INITIAL_PAUSE_MS

  for (let index = 1; index < points.length; index += 1) {
    stages.push({
      type: 'move',
      startMs: cursor,
      endMs: cursor + TREND_MOVE_MS,
      fromVertexIndex: index - 1,
      toVertexIndex: index,
      fromLength: cumulativeLengths[index - 1],
      toLength: cumulativeLengths[index],
    })
    cursor += TREND_MOVE_MS

    const pauseDuration = index === points.length - 1
      ? TREND_FINAL_HOLD_MS
      : TREND_VERTEX_PAUSE_MS
    stages.push({
      type: 'pause',
      startMs: cursor,
      endMs: cursor + pauseDuration,
      vertexIndex: index,
      length: cumulativeLengths[index],
    })
    cursor += pauseDuration
  }

  return {
    cumulativeLengths,
    stages,
    totalLength: cumulativeLengths.at(-1) ?? 0,
    totalDurationMs: cursor,
  }
}

export function pointAtTrendLength(
  points: readonly TrendAnimationPoint[],
  cumulativeLengths: readonly number[],
  requestedLength: number,
): TrendAnimationPoint {
  const totalLength = cumulativeLengths.at(-1) ?? 0
  const length = Math.min(Math.max(requestedLength, 0), totalLength)

  for (let index = 1; index < cumulativeLengths.length; index += 1) {
    if (length > cumulativeLengths[index]) continue
    const startLength = cumulativeLengths[index - 1]
    const segmentLength = cumulativeLengths[index] - startLength
    const progress = segmentLength === 0 ? 1 : (length - startLength) / segmentLength
    return {
      x: points[index - 1].x + (points[index].x - points[index - 1].x) * progress,
      y: points[index - 1].y + (points[index].y - points[index - 1].y) * progress,
    }
  }

  return { ...points[points.length - 1] }
}

export function sampleFeedbackTrendTimeline(
  points: readonly TrendAnimationPoint[],
  timeline: TrendAnimationTimeline,
  elapsedMs: number,
): TrendAnimationFrame {
  const elapsed = Math.min(Math.max(elapsedMs, 0), timeline.totalDurationMs)
  const stage = timeline.stages.find(candidate => (
    elapsed >= candidate.startMs && elapsed < candidate.endMs
  ))

  if (!stage) {
    const finalIndex = points.length - 1
    return {
      complete: true,
      length: timeline.totalLength,
      marker: { ...points[finalIndex] },
      pausedVertexIndex: finalIndex,
      reachedVertexIndex: finalIndex,
    }
  }

  if (stage.type === 'pause') {
    return {
      complete: false,
      length: stage.length,
      marker: { ...points[stage.vertexIndex] },
      pausedVertexIndex: stage.vertexIndex,
      reachedVertexIndex: stage.vertexIndex,
    }
  }

  const linearProgress = (elapsed - stage.startMs) / (stage.endMs - stage.startMs)
  const easedProgress = easeInOutCubic(linearProgress)
  const length = stage.fromLength
    + (stage.toLength - stage.fromLength) * easedProgress

  return {
    complete: false,
    length,
    marker: pointAtTrendLength(points, timeline.cumulativeLengths, length),
    pausedVertexIndex: null,
    reachedVertexIndex: stage.fromVertexIndex,
  }
}
