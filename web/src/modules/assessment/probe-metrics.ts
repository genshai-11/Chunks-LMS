/**
 * Probe counters for teacher/analysis UI.
 *
 * Product language (not sample size):
 * - **n count** = times teacher chose Green (2) → entered probe flow
 * - **n depth** = probeCount on one attempt (Pass/Continue steps + final resolve)
 * - **n depth max** = max observed probeCount in the window
 * - **n depth avg** = mean probeCount over probed attempts
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
  /** Max observed probe depth (not session maxProbeCount ceiling) */
  nDepthMax: number | null
  /** Mean probe depth over probed attempts */
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
    'Probe depth for one question: each Pass (Continue) increments depth; Done/Fail also count when leaving the open probe. Example: Green once + Pass ×8 + Done → n depth = 9.',
  nDepthMax: 'Highest n depth observed in this window (peak probe depth).',
  nDepthAvg: 'Average n depth across questions that entered the probe flow.',
} as const

/** Per-attempt depth; null when never entered probe. */
export function attemptNDepth(a: ProbeAttemptLike): number | null {
  if (!a.enteredProbeFlow && a.probeCount <= 0) return null
  return a.probeCount
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
    sum += a.probeCount
    max = Math.max(max, a.probeCount)
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
