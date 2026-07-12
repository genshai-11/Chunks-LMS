/**
 * Teacher-facing probe labels.
 *
 * - **n depth** = probeCount after Green (Pass/Continue / resolve steps).
 * - **n count** = session-level count of Green entries (see probe-metrics).
 * - **ceiling** = maxProbeCount (configured session limit — not observed peak).
 *
 * Do not reuse "n" for sample size / finalized question count — use "finalized" or "sample".
 */

import type { AssessmentSnapshot } from '../result-lifecycle/types'
import { PROBE_METRIC_LABELS } from './probe-metrics'

export function probeN(snapshot: Pick<AssessmentSnapshot, 'probeCount' | 'enteredProbeFlow'> | null | undefined): number | null {
  if (!snapshot) return null
  if (!snapshot.enteredProbeFlow && snapshot.probeCount <= 0) return null
  return snapshot.probeCount
}

/** @deprecated Prefer naming as session ceiling, not n depth max */
export function probeDepthMax(
  snapshot: Pick<AssessmentSnapshot, 'maxProbeCount'> | null | undefined,
  fallbackMax = 0,
): number {
  if (snapshot?.maxProbeCount != null && snapshot.maxProbeCount > 0) {
    return snapshot.maxProbeCount
  }
  return fallbackMax
}

/** Compact cell text: "n depth=2" or "—" */
export function formatProbeCell(
  snapshot: AssessmentSnapshot | null | undefined,
  _sessionMaxProbe?: number,
): string {
  const n = probeN(snapshot)
  if (n == null) return '—'
  return `${PROBE_METRIC_LABELS.nDepth}=${n}`
}

/** Live badge while probe is open */
export function formatProbeLive(
  probeCount: number,
  maxProbeCount: number,
): { nLabel: string; depthLabel: string } {
  return {
    nLabel: `${PROBE_METRIC_LABELS.nDepth}=${probeCount}`,
    depthLabel: maxProbeCount > 0 ? `ceiling ${maxProbeCount}` : 'ceiling —',
  }
}
