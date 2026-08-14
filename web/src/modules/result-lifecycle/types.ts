/**
 * 7-Color Rainbow spectrum for assessment:
 * Red (Đỏ), Orange (Cam), Yellow (Vàng), Green (Lục/Xanh), Blue (Lam), Indigo (Chàm), Purple (Tím).
 */
export type ResultColor =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'indigo'
  | 'purple'

export type PrimaryObservationColor = 'red' | 'orange' | 'green' | 'purple'

export type ProvisionalColor = ResultColor

export type ProbeOutcome = 'fail' | 'continue' | 'done'

export const WARM_COLORS: readonly ResultColor[] = ['red', 'orange', 'yellow']
export const COOL_COLORS: readonly ResultColor[] = ['green', 'blue', 'indigo', 'purple']

export function isWarmColor(color: ResultColor): boolean {
  return color === 'red' || color === 'orange' || color === 'yellow'
}

export function isCoolColor(color: ResultColor): boolean {
  return color === 'green' || color === 'blue' || color === 'indigo' || color === 'purple'
}

export type AttemptStatus =
  | 'draft'
  | 'probe_open'
  | 'resolution_required'
  | 'finalized'
  | 'corrected'

export type AssessmentEventType =
  | 'assessment_created'
  | 'provisional_recorded'
  | 'probe_failed'
  | 'probe_continued'
  | 'probe_completed'
  | 'result_finalized'
  | 'result_corrected'

export type AssessmentSnapshot = {
  status: AttemptStatus
  provisionalColor: ProvisionalColor | null
  effectiveColor: ResultColor | null
  effectiveScore: number | null
  probeCount: number
  maxProbeCount: number
  enteredProbeFlow: boolean
  /**
   * Complete ordered sequence of colors recorded for this question
   * (e.g. ['red'] or ['green', 'blue', 'blue', 'indigo']).
   */
  recordedColors: ResultColor[]
  finalizedAt: string | null
}

export type LifecycleCommand =
  | { type: 'record_provisional'; color: ProvisionalColor; at: string }
  | { type: 'resolve_probe'; outcome: ProbeOutcome; at: string }
  | { type: 'correct'; color: ResultColor; reason: string; at: string; actorId: string }

export type LifecycleResult =
  | { ok: true; snapshot: AssessmentSnapshot; events: AssessmentEventType[] }
  | { ok: false; error: string }

export const COLOR_SCORE: Record<ResultColor, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  green: 3,
  blue: 4,
  indigo: 5,
  purple: 6,
}

export const DEFAULT_COLOR_WEIGHTS: Record<ResultColor, number> = {
  red: 0,
  orange: 1 / 6,
  yellow: 2 / 6,
  green: 3 / 6,
  blue: 4 / 6,
  indigo: 5 / 6,
  purple: 1,
}

export const DEFAULT_MAX_PROBE_COUNT = 99
