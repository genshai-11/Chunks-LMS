import {
  DEFAULT_COLOR_WEIGHTS,
  isCoolColor,
  isWarmColor,
  type ResultColor,
} from '../result-lifecycle/types'

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
  | 'average_cpd'

export type MetricStatus = 'operational' | 'experimental'

export type FinalizedAttempt = {
  effectiveColor: ResultColor
  enteredProbeFlow: boolean
  probeEventCount: number
  /** Complete ordered sequence of colors recorded for this question (e.g. ['green', 'blue', 'indigo']). */
  recordedColors?: ResultColor[]
  /** Optional test metadata for CPD derivation */
  cvr?: number | null
  cci?: number | null
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
    version: '2.0.0',
    status: 'operational',
    definition: 'Warm colors (Red + Orange + Yellow) / expanded sample (including probe steps)',
    direction: 'lower_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'rac',
    version: '2.0.0',
    status: 'operational',
    definition: '1 - RFC (Cool colors Green + Blue + Indigo + Purple / expanded sample)',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'average_performance',
    version: '2.0.0',
    status: 'operational',
    definition: 'mean normalized color weight 0..1 over expanded sample',
    direction: 'higher_better',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'purple_mastery_rate',
    version: '2.0.0',
    status: 'operational',
    definition: 'Purple / finalized question sample',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'clarification_rate',
    version: '1.0.0',
    status: 'operational',
    definition: 'attempts entering probe flow / finalized questions',
    direction: 'contextual',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'clarification_depth',
    version: '1.0.0',
    status: 'experimental',
    definition: 'probe steps / probed attempts (legacy alias of avg probe steps)',
    direction: 'contextual',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'n_count',
    version: '1.0.0',
    status: 'operational',
    definition: 'count of finalized attempts where teacher selected Green / entered probe',
    direction: 'contextual',
    unit: 'count',
    minSample: 1,
  },
  {
    key: 'n_depth_max',
    version: '1.0.0',
    status: 'operational',
    definition: 'max probe depth among probed attempts',
    direction: 'contextual',
    unit: 'count',
    minSample: 1,
  },
  {
    key: 'n_depth_avg',
    version: '1.0.0',
    status: 'operational',
    definition: 'mean probe depth among probed attempts',
    direction: 'contextual',
    unit: 'score',
    minSample: 1,
  },
  {
    key: 'awareness_recovery',
    version: '2.0.0',
    status: 'experimental',
    definition: 'probed attempts ending in Cool colors (Indigo/Green) / probed attempts',
    direction: 'higher_better',
    unit: 'ratio',
    minSample: 1,
  },
  {
    key: 'focus_stability',
    version: '2.0.0',
    status: 'experimental',
    definition: 'normalized inverse of adjacent score movement per learner',
    direction: 'contextual',
    unit: 'score',
    minSample: 2,
  },
  {
    key: 'average_cpd',
    version: '2.0.0',
    status: 'operational',
    definition: 'mean Question CPD (CVR × CCI × mean question color weight) across finalized attempts',
    direction: 'higher_better',
    unit: 'score',
    minSample: 1,
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

export type ColorWeights = Record<ResultColor, number>

export type QuestionCpdResult = {
  baseCpd: number | null
  questionCpd: number | null
  colors: ResultColor[]
  weights: number[]
}

export function calculateQuestionCpd(
  attempt: FinalizedAttempt,
  weights: ColorWeights = DEFAULT_COLOR_WEIGHTS,
): QuestionCpdResult {
  const cvr = attempt.cvr ?? null
  const cci = attempt.cci ?? null
  const colors: ResultColor[] = attempt.recordedColors && attempt.recordedColors.length > 0
    ? attempt.recordedColors
    : [attempt.effectiveColor]

  const appliedWeights = colors.map((c) => weights[c] ?? DEFAULT_COLOR_WEIGHTS[c])

  if (cvr == null || cci == null) {
    return {
      baseCpd: null,
      questionCpd: null,
      colors,
      weights: appliedWeights,
    }
  }

  const baseCpd = cvr * cci
  const meanWeight = appliedWeights.reduce((s, w) => s + w, 0) / appliedWeights.length
  const questionCpd = baseCpd * meanWeight

  return {
    baseCpd,
    questionCpd,
    colors,
    weights: appliedWeights,
  }
}

export function calculateMetrics(
  finalized: FinalizedAttempt[],
  colorWeights: ColorWeights = DEFAULT_COLOR_WEIGHTS,
): MetricObservation[] {
  const questionCount = finalized.length

  // Flatten all recorded colors across all questions for expanded sample N_total
  const allRecordedColors: ResultColor[] = finalized.flatMap((a) =>
    a.recordedColors && a.recordedColors.length > 0 ? a.recordedColors : [a.effectiveColor],
  )
  const totalExpandedSample = allRecordedColors.length

  const warmCount = allRecordedColors.filter(isWarmColor).length
  const purpleCount = finalized.filter((a) => a.effectiveColor === 'purple').length

  const totalScore = allRecordedColors.reduce((sum, c) => sum + (colorWeights[c] ?? DEFAULT_COLOR_WEIGHTS[c]), 0)
  const avgPerformance = totalExpandedSample === 0 ? null : totalScore / totalExpandedSample

  const probed = finalized.filter((a) => a.enteredProbeFlow)
  const chunksNumbers = probed.map((a) =>
    a.recordedColors && a.recordedColors.length > 1
      ? a.recordedColors.length
      : Math.max(1, a.probeEventCount + 1),
  )
  const chunksNumberTotal = chunksNumbers.reduce((s, value) => s + value, 0)
  const probeDepthMax = probed.length === 0 ? null : Math.max(...chunksNumbers)
  const probeDepthAvg = probed.length === 0 ? null : chunksNumberTotal / probed.length

  const recovered = probed.filter((a) => isCoolColor(a.effectiveColor)).length

  // Calculate CPD across attempts with CVR/CCI metadata
  const cpdResults = finalized
    .map((a) => calculateQuestionCpd(a, colorWeights))
    .filter((r) => r.questionCpd !== null)
  const avgCpd = cpdResults.length === 0
    ? null
    : cpdResults.reduce((s, r) => s + (r.questionCpd ?? 0), 0) / cpdResults.length

  const rfcVal = ratio(warmCount, totalExpandedSample)
  const racVal = rfcVal !== null ? 1 - rfcVal : null

  const rfc = observation('rfc', rfcVal, totalExpandedSample)
  const rac = observation('rac', racVal, totalExpandedSample)
  const avg = observation('average_performance', avgPerformance, totalExpandedSample)
  const purpleRate = observation('purple_mastery_rate', ratio(purpleCount, questionCount), questionCount)
  const clarRate = observation('clarification_rate', questionCount === 0 ? null : probed.length / questionCount, questionCount)
  const clarDepth = observation('clarification_depth', probeDepthAvg, probed.length)
  const nCount = observation('n_count', questionCount === 0 ? null : probed.length, questionCount)
  const nDepthMax = observation('n_depth_max', probeDepthMax, probed.length)
  const nDepthAvg = observation('n_depth_avg', probeDepthAvg, probed.length)
  const awareness = observation(
    'awareness_recovery',
    probed.length === 0 ? null : recovered / probed.length,
    probed.length,
  )
  const stability = observation('focus_stability', focusStability(finalized, colorWeights), questionCount)
  const cpdObs = observation('average_cpd', avgCpd, cpdResults.length)

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
    cpdObs,
  ]
}

/**
 * Normalized inverse of mean adjacent absolute score deltas across learners.
 * Returns null if fewer than two observations overall.
 */
function focusStability(
  finalized: FinalizedAttempt[],
  weights: ColorWeights = DEFAULT_COLOR_WEIGHTS,
): number | null {
  if (finalized.length < 2) return null

  const byLearner = new Map<string, number[]>()
  for (const a of finalized) {
    const id = a.learnerId ?? '_all'
    const list = byLearner.get(id) ?? []
    list.push(weights[a.effectiveColor] ?? DEFAULT_COLOR_WEIGHTS[a.effectiveColor])
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
  // max adjacent move is 1.0 (0.0 ↔ 1.0); stability in [0, 1]
  return Math.max(0, 1 - meanDelta)
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
  colorWeights: ColorWeights = DEFAULT_COLOR_WEIGHTS,
): WindowComparison {
  const current = calculateMetrics(currentFinalized, colorWeights)
  if (previousFinalized === null) {
    return { current, previous: null, deltas: {} }
  }
  const previous = calculateMetrics(previousFinalized, colorWeights)
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
