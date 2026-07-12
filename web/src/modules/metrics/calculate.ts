import { COLOR_SCORE, type ResultColor } from '../result-lifecycle/types'

export type MetricKey =
  | 'rfc'
  | 'rac'
  | 'average_performance'
  | 'purple_mastery_rate'
  | 'clarification_rate'
  | 'clarification_depth'
  | 'n_count'
  | 'n_depth_max'
  | 'n_depth_avg'
  | 'awareness_recovery'
  | 'focus_stability'

export type MetricStatus = 'operational' | 'experimental'

export type FinalizedAttempt = {
  effectiveColor: ResultColor
  enteredProbeFlow: boolean
  probeEventCount: number
  /** Ordered score history for focus stability (learner-adjacent). */
  learnerId?: string
  sequenceIndex?: number
}

export type MetricObservation = {
  key: MetricKey
  value: number | null
  sampleSize: number
  unit: 'ratio' | 'score' | 'count'
  direction: 'higher_better' | 'lower_better' | 'contextual'
  status: MetricStatus
  definition: string
}

export type MetricCatalogEntry = {
  key: MetricKey
  version: string
  status: MetricStatus
  definition: string
  direction: MetricObservation['direction']
  unit: MetricObservation['unit']
  minSample: number
}

export const METRIC_CATALOG: MetricCatalogEntry[] = [
  {
    key: 'rfc',
    version: '1.0.0',
    status: 'operational',
    definition: '(Red + Yellow) / finalized N',
    direction: 'lower_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'rac',
    version: '1.0.0',
    status: 'operational',
    definition: '(Green + Purple) / finalized N',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'average_performance',
    version: '1.0.0',
    status: 'operational',
    definition: 'mean color score 0..3 over finalized N',
    direction: 'higher_better',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'purple_mastery_rate',
    version: '1.0.0',
    status: 'operational',
    definition: 'Purple / finalized N',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'clarification_rate',
    version: '1.0.0',
    status: 'operational',
    definition: 'attempts entering probe flow / finalized N',
    direction: 'contextual',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'clarification_depth',
    version: '1.0.0',
    status: 'experimental',
    definition: 'probe-event count / probed attempts (legacy alias of n depth avg)',
    direction: 'contextual',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'n_count',
    version: '1.0.0',
    status: 'operational',
    definition: 'count of finalized attempts where teacher selected Green (2) / entered probe',
    direction: 'contextual',
    unit: 'count',
    minSample: 1,
  },
  {
    key: 'n_depth_max',
    version: '1.0.0',
    status: 'operational',
    definition: 'max probeCount among probed attempts (peak n depth; not session maxProbeCount)',
    direction: 'contextual',
    unit: 'count',
    minSample: 1,
  },
  {
    key: 'n_depth_avg',
    version: '1.0.0',
    status: 'operational',
    definition: 'mean probeCount among probed attempts (n depth avg)',
    direction: 'contextual',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'awareness_recovery',
    version: '1.0.0',
    status: 'experimental',
    definition: 'probed attempts ending Green or Purple / probed attempts',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'focus_stability',
    version: '1.0.0',
    status: 'experimental',
    definition: 'normalized inverse of adjacent score movement per learner',
    direction: 'contextual',
    unit: 'score',
    minSample: 2,
  },
]

function ratio(num: number, den: number): number | null {
  if (den === 0) return null
  return num / den
}

function observation(
  key: MetricKey,
  value: number | null,
  sampleSize: number,
): MetricObservation {
  const meta = METRIC_CATALOG.find((m) => m.key === key)!
  const belowMin = sampleSize < meta.minSample
  return {
    key,
    value: belowMin ? null : value,
    sampleSize,
    unit: meta.unit,
    direction: meta.direction,
    status: meta.status,
    definition: meta.definition,
  }
}

export function calculateMetrics(finalized: FinalizedAttempt[]): MetricObservation[] {
  const n = finalized.length
  const redYellow = finalized.filter(
    (a) => a.effectiveColor === 'red' || a.effectiveColor === 'yellow',
  ).length
  const greenPurple = finalized.filter(
    (a) => a.effectiveColor === 'green' || a.effectiveColor === 'purple',
  ).length
  const purple = finalized.filter((a) => a.effectiveColor === 'purple').length
  const scoreSum = finalized.reduce((s, a) => s + COLOR_SCORE[a.effectiveColor], 0)
  const probed = finalized.filter((a) => a.enteredProbeFlow)
  const probeEventTotal = probed.reduce((s, a) => s + a.probeEventCount, 0)
  const probeDepthMax =
    probed.length === 0 ? null : Math.max(...probed.map((a) => a.probeEventCount))
  const probeDepthAvg = probed.length === 0 ? null : probeEventTotal / probed.length
  const recovered = probed.filter(
    (a) => a.effectiveColor === 'green' || a.effectiveColor === 'purple',
  ).length

  const rfc = observation('rfc', ratio(redYellow, n), n)
  const rac = observation('rac', ratio(greenPurple, n), n)
  const avg = observation('average_performance', n === 0 ? null : scoreSum / n, n)
  const purpleRate = observation('purple_mastery_rate', ratio(purple, n), n)
  // Clarification rate: 0 when N>0 and none probed; null when N=0
  const clarRate = observation('clarification_rate', n === 0 ? null : probed.length / n, n)
  const clarDepth = observation('clarification_depth', probeDepthAvg, probed.length)
  const nCount = observation('n_count', n === 0 ? null : probed.length, n)
  const nDepthMax = observation('n_depth_max', probeDepthMax, probed.length)
  const nDepthAvg = observation('n_depth_avg', probeDepthAvg, probed.length)
  const awareness = observation(
    'awareness_recovery',
    probed.length === 0 ? null : recovered / probed.length,
    probed.length,
  )
  const stability = observation('focus_stability', focusStability(finalized), n)

  return [
    rfc,
    rac,
    avg,
    purpleRate,
    clarRate,
    clarDepth,
    nCount,
    nDepthMax,
    nDepthAvg,
    awareness,
    stability,
  ]
}

/**
 * Normalized inverse of mean adjacent absolute score deltas across learners.
 * Returns null if fewer than two observations overall.
 */
function focusStability(finalized: FinalizedAttempt[]): number | null {
  if (finalized.length < 2) return null

  const byLearner = new Map<string, number[]>()
  for (const a of finalized) {
    const id = a.learnerId ?? '_all'
    const list = byLearner.get(id) ?? []
    list.push(COLOR_SCORE[a.effectiveColor])
    byLearner.set(id, list)
  }

  const deltas: number[] = []
  for (const scores of byLearner.values()) {
    if (scores.length < 2) continue
    for (let i = 1; i < scores.length; i++) {
      deltas.push(Math.abs(scores[i]! - scores[i - 1]!))
    }
  }
  if (deltas.length === 0) return null

  const meanDelta = deltas.reduce((s, d) => s + d, 0) / deltas.length
  // max adjacent move is 3 (0↔3); stability in [0,1]
  return 1 - meanDelta / 3
}

export type WindowComparison = {
  current: MetricObservation[]
  previous: MetricObservation[] | null
  /** Percentage-point deltas for ratio metrics; null if either side null. */
  deltas: Partial<Record<MetricKey, number | null>>
}

export function compareEqualDurationWindows(
  currentFinalized: FinalizedAttempt[],
  previousFinalized: FinalizedAttempt[] | null,
): WindowComparison {
  const current = calculateMetrics(currentFinalized)
  if (previousFinalized === null) {
    return { current, previous: null, deltas: {} }
  }
  const previous = calculateMetrics(previousFinalized)
  const deltas: WindowComparison['deltas'] = {}
  for (const c of current) {
    const p = previous.find((x) => x.key === c.key)
    if (!p || c.value === null || p.value === null) {
      deltas[c.key] = null
    } else if (c.unit === 'ratio') {
      // percentage-point change
      deltas[c.key] = (c.value - p.value) * 100
    } else {
      deltas[c.key] = c.value - p.value
    }
  }
  return { current, previous, deltas }
}
