/** Canonical seven-color assessment spectrum. UI and metrics must consume this authority. */
export const RESULT_COLORS = [
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'indigo',
  'purple',
] as const

export type ResultColor = (typeof RESULT_COLORS)[number]

export const PRIMARY_OBSERVATION_COLORS = ['red', 'orange', 'green', 'purple'] as const
export type PrimaryObservationColor = (typeof PRIMARY_OBSERVATION_COLORS)[number]

export type ResultColorMeta = {
  label: string
  hex: string
  shortcut: string
  partition: 'warm' | 'cool'
}

export const RESULT_COLOR_META: Record<ResultColor, ResultColorMeta> = {
  red: { label: 'Red', hex: '#ef4444', shortcut: '0', partition: 'warm' },
  orange: { label: 'Orange', hex: '#f97316', shortcut: '1', partition: 'warm' },
  yellow: { label: 'Yellow', hex: '#eab308', shortcut: 'F', partition: 'warm' },
  green: { label: 'Green', hex: '#22c55e', shortcut: '2', partition: 'cool' },
  blue: { label: 'Blue', hex: '#0ea5e9', shortcut: 'C', partition: 'cool' },
  indigo: { label: 'Indigo', hex: '#6366f1', shortcut: 'D', partition: 'cool' },
  purple: { label: 'Purple', hex: '#a855f7', shortcut: '3', partition: 'cool' },
}

export type ProvisionalColor = ResultColor

export type ProbeOutcome = 'fail' | 'continue' | 'done'

export const WARM_COLORS = RESULT_COLORS.filter(
  (color) => RESULT_COLOR_META[color].partition === 'warm',
) as readonly ResultColor[]
export const COOL_COLORS = RESULT_COLORS.filter(
  (color) => RESULT_COLOR_META[color].partition === 'cool',
) as readonly ResultColor[]

export function isResultColor(value: unknown): value is ResultColor {
  return typeof value === 'string' && (RESULT_COLORS as readonly string[]).includes(value)
}

export function isWarmColor(color: ResultColor): boolean {
  return RESULT_COLOR_META[color].partition === 'warm'
}

export function isCoolColor(color: ResultColor): boolean {
  return RESULT_COLOR_META[color].partition === 'cool'
}

export function resultColorLabel(color: ResultColor): string {
  return RESULT_COLOR_META[color].label
}

export function resultColorHex(color: ResultColor): string {
  return RESULT_COLOR_META[color].hex
}

export function emptyResultColorCounts(): Record<ResultColor, number> {
  return Object.fromEntries(RESULT_COLORS.map((color) => [color, 0])) as Record<
    ResultColor,
    number
  >
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
