/**
 * Probe counters for teacher/analysis UI.
 *
 * Product language (not sample size):
 * - **n count** = times teacher chose Green (2) → entered probe flow
 * - **n depth** = displayed probe depth for one attempt; Green opens at 1
 * - **n depth max** = max displayed n depth in the window
 * - **n depth avg** = mean displayed n depth over probed attempts
 *
 * Do not call finalized sample size "n" — use sample / finalized.
 */

export type ProbeAttemptLike = {
  enteredProbeFlow: boolean
  probeCount: number
}

export type ProbeAggregates = {
  /** Times Green opened probe flow */
  nCount: number
  /** Max observed n depth (not session maxProbeCount ceiling) */
  nDepthMax: number | null
  /** Mean n depth over probed attempts */
  nDepthAvg: number | null
  /** Attempts that entered probe flow */
  probedCount: number
}

export const PROBE_METRIC_LABELS = {
  nCount: 'n count',
  nDepth: 'n depth',
  nDepthMax: 'n depth max',
  nDepthAvg: 'n depth avg',
} as const

export const PROBE_METRIC_TOOLTIPS = {
  nCount:
    'Number of times the teacher selected Green (2) and entered the probe sub-screens.',
  nDepth:
    'n depth for one question: Green opens at 1, and each Continue adds 1. Fail/Done resolve the current n depth. Example: Green + Continue ×8 + Done → n depth = 9.',
  nDepthMax: 'Highest n depth observed in this window.',
  nDepthAvg: 'Average n depth across questions that entered the probe flow.',
} as const

/** Displayed n depth; null when never entered probe. */
export function probeChunksNumber(a: ProbeAttemptLike): number | null {
  if (!a.enteredProbeFlow && a.probeCount <= 0) return null
  return Math.max(1, a.probeCount + 1)
}

/** Backwards-compatible helper name for callers that still use the old n-depth code name. */
export function attemptNDepth(a: ProbeAttemptLike): number | null {
  return probeChunksNumber(a)
}

export function aggregateProbeMetrics(attempts: ProbeAttemptLike[]): ProbeAggregates {
  const probed = attempts.filter((a) => a.enteredProbeFlow || a.probeCount > 0)
  const nCount = attempts.filter((a) => a.enteredProbeFlow).length
  if (probed.length === 0) {
    return { nCount, nDepthMax: null, nDepthAvg: null, probedCount: 0 }
  }
  let sum = 0
  let max = 0
  for (const a of probed) {
    const chunksNumber = probeChunksNumber(a) ?? 0
    sum += chunksNumber
    max = Math.max(max, chunksNumber)
  }
  return {
    nCount,
    nDepthMax: max,
    nDepthAvg: sum / probed.length,
    probedCount: probed.length,
  }
}

export function formatNDepthAvg(value: number | null, digits = 1): string {
  if (value == null) return '—'
  return value.toFixed(digits)
}
