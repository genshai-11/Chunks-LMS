/** 0=Sunday … 6=Saturday (JS Date convention) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type WeeklyScheduleInput = {
  /** ISO date of first occurrence window (YYYY-MM-DD) */
  startDate: string
  /** Inclusive end date of course/window */
  endDate: string
  /** 0=Sunday .. 6=Saturday */
  dayOfWeek: number
  timeZone: string
  durationMinutes: number
}

export type MultiWeekdayScheduleInput = {
  startDate: string
  /** Meeting days, e.g. Tue+Wed = [2, 3] */
  weekdays: number[]
  /** Number of class meetings to generate (default 15) */
  sessionCount: number
  /** Local start time HH:mm */
  startTime: string
  timeZone: string
  durationMinutes: number
}

export type MaterializedOccurrence = {
  plannedStartDate: string
  /** ISO datetime local intent as UTC wall-clock for storage (date + time) */
  plannedStart: string
  sequence: number
  timeZone: string
  durationMinutes: number
  dayOfWeek: number
}

export type CourseSchedulePlan = {
  occurrences: MaterializedOccurrence[]
  /** Auto-detected end date = last session date */
  endsOn: string | null
  sessionCount: number
}

/**
 * Materialize weekly occurrences between start and end (inclusive by date string YYYY-MM-DD).
 * V1 keeps recurrence simple: weekly only, explicit materialization.
 */
export function materializeWeekly(input: WeeklyScheduleInput): MaterializedOccurrence[] {
  const start = parseDate(input.startDate)
  const end = parseDate(input.endDate)
  if (end < start) return []

  const occurrences: MaterializedOccurrence[] = []
  const cursor = new Date(start)

  while (cursor.getUTCDay() !== input.dayOfWeek && cursor <= end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  let sequence = 0
  while (cursor <= end) {
    const plannedStartDate = toIsoDate(cursor)
    occurrences.push({
      plannedStartDate,
      plannedStart: combineDateAndTime(plannedStartDate, '09:00'),
      sequence,
      timeZone: input.timeZone,
      durationMinutes: input.durationMinutes,
      dayOfWeek: input.dayOfWeek,
    })
    sequence += 1
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return occurrences
}

/**
 * Materialize the next `sessionCount` meetings from startDate on selected weekdays.
 * End day is auto-detected as the date of the last occurrence.
 *
 * Example: start Mon 2026-07-06, weekdays Tue+Wed, 15 sessions
 * → meetings every Tue/Wed until 15 dates; endsOn = last meeting date.
 */
export function materializeSessionCount(input: MultiWeekdayScheduleInput): CourseSchedulePlan {
  const weekdays = normalizeWeekdays(input.weekdays)
  if (weekdays.length === 0 || input.sessionCount < 1) {
    return { occurrences: [], endsOn: null, sessionCount: 0 }
  }

  const start = parseDate(input.startDate)
  const occurrences: MaterializedOccurrence[] = []
  const cursor = new Date(start)
  // Safety: max ~2 years of daily steps
  const maxSteps = 366 * 2
  let steps = 0
  let sequence = 0

  while (occurrences.length < input.sessionCount && steps < maxSteps) {
    const dow = cursor.getUTCDay()
    if (weekdays.includes(dow)) {
      const plannedStartDate = toIsoDate(cursor)
      occurrences.push({
        plannedStartDate,
        plannedStart: combineDateAndTime(plannedStartDate, input.startTime),
        sequence,
        timeZone: input.timeZone,
        durationMinutes: input.durationMinutes,
        dayOfWeek: dow,
      })
      sequence += 1
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    steps += 1
  }

  const endsOn =
    occurrences.length > 0
      ? occurrences[occurrences.length - 1]!.plannedStartDate
      : null

  return {
    occurrences,
    endsOn,
    sessionCount: occurrences.length,
  }
}

/** Compute only the end date for a course auto-schedule (no full list needed in UI previews). */
export function computeCourseEndDate(input: MultiWeekdayScheduleInput): string | null {
  return materializeSessionCount(input).endsOn
}

export function formatWeekdaysLabel(weekdays: number[]): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return normalizeWeekdays(weekdays)
    .map((d) => labels[d] ?? String(d))
    .join(', ')
}

function normalizeWeekdays(weekdays: number[]): number[] {
  return [...new Set(weekdays.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
}

function parseDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!))
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Store as ISO string with local wall-clock time (no TZ conversion for V1 demo). */
function combineDateAndTime(isoDate: string, hhmm: string): string {
  const time = /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : '09:00'
  return `${isoDate}T${time}:00.000Z`
}
