/**
 * Teacher-facing probe labels.
 *
 * - **n** = probeCount = depth after Green (Continue / resolve steps).
 *   Each Continue increments n; Done/Fail may increment once when leaving probe_open.
 * - **depth max** = maxProbeCount = session ceiling shown to teachers (Continue is unlimited in domain).
 *
 * Do not reuse "n" for sample size / finalized question count — use "finalized" or "N samples".
 */

import type { AssessmentSnapshot } from '../result-lifecycle/types'

export function probeN(snapshot: Pick<AssessmentSnapshot, 'probeCount' | 'enteredProbeFlow'> | null | undefined): number | null {
  if (!snapshot) return null
  if (!snapshot.enteredProbeFlow && snapshot.probeCount <= 0) return null
  return snapshot.probeCount
}

export function probeDepthMax(
  snapshot: Pick<AssessmentSnapshot, 'maxProbeCount'> | null | undefined,
  fallbackMax = 0,
): number {
  if (snapshot?.maxProbeCount != null && snapshot.maxProbeCount > 0) {
    return snapshot.maxProbeCount
  }
  return fallbackMax
}

/** Compact cell text: "n=2 · max 3" or "—" */
export function formatProbeCell(
  snapshot: AssessmentSnapshot | null | undefined,
  sessionMaxProbe?: number,
): string {
  const n = probeN(snapshot)
  if (n == null) return '—'
  const max = probeDepthMax(snapshot, sessionMaxProbe ?? 0)
  if (max > 0) return `n=${n} · max ${max}`
  return `n=${n}`
}

/** Live badge while probe is open */
export function formatProbeLive(
  probeCount: number,
  maxProbeCount: number,
): { nLabel: string; depthLabel: string } {
  return {
    nLabel: `n=${probeCount}`,
    depthLabel: maxProbeCount > 0 ? `depth max ${maxProbeCount}` : 'depth max —',
  }
}
