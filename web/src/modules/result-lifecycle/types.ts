/** Color values: Red=0, Yellow=1, Green=2, Purple=3 */
export type ResultColor = 'red' | 'yellow' | 'green' | 'purple'

export type ProvisionalColor = ResultColor

export type ProbeOutcome = 'fail' | 'continue' | 'done'

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
  yellow: 1,
  green: 2,
  purple: 3,
}

export const DEFAULT_MAX_PROBE_COUNT = 2
