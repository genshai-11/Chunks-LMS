import { newId } from '../roster/seed'
import { materializeCourseSchedule } from './recurrence'
import type { Course } from '../roster/types'
import { normalizeCourseSchedule } from '../roster/schedule'
import type {
  AttendanceRecord,
  AttendanceStatus,
  LearningSession,
  ScheduledSession,
  SchedulingState,
} from './types'

export type SchedulingResult<T> =
  | { ok: true; value: T; state: SchedulingState }
  | { ok: false; error: string }

export function emptySchedulingState(): SchedulingState {
  return { scheduledSessions: [], learningSessions: [], attendance: [] }
}

/** Re-number scheduled sessions for a class by plannedStart (1..N). */
export function reindexSessionNumbers(
  state: SchedulingState,
  classId: string,
): SchedulingState {
  const ordered = state.scheduledSessions
    .filter((s) => s.classId === classId && s.status !== 'cancelled' && s.status !== 'rescheduled')
    .slice()
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))

  const numberById = new Map<string, number>()
  ordered.forEach((s, i) => numberById.set(s.id, i + 1))

  return {
    ...state,
    scheduledSessions: state.scheduledSessions.map((s) => {
      if (s.classId !== classId) return s
      if (s.status === 'cancelled' || s.status === 'rescheduled') {
        return { ...s, sessionNumber: s.sessionNumber }
      }
      return { ...s, sessionNumber: numberById.get(s.id) ?? s.sessionNumber }
    }),
    learningSessions: state.learningSessions.map((ls) => {
      if (ls.classId !== classId) return ls
      if (ls.scheduledSessionId && numberById.has(ls.scheduledSessionId)) {
        return { ...ls, sessionNumber: numberById.get(ls.scheduledSessionId)! }
      }
      return ls
    }),
  }
}

export function createScheduledSession(
  state: SchedulingState,
  input: {
    classId: string
    plannedStart: string
    durationMinutes: number
    sessionNumber?: number | null
  },
): SchedulingResult<ScheduledSession> {
  if (input.durationMinutes < 1) {
    return { ok: false, error: 'Duration must be positive' }
  }
  const session: ScheduledSession = {
    id: newId('sched'),
    classId: input.classId,
    plannedStart: input.plannedStart,
    durationMinutes: input.durationMinutes,
    status: 'scheduled',
    rescheduledFromId: null,
    sessionNumber: input.sessionNumber ?? null,
  }
  const withRow = {
    ...state,
    scheduledSessions: [...state.scheduledSessions, session],
  }
  const reindexed = reindexSessionNumbers(withRow, input.classId)
  const value = reindexed.scheduledSessions.find((s) => s.id === session.id) ?? session
  return {
    ok: true,
    value,
    state: reindexed,
  }
}

/**
 * Materialize course auto-schedule into Scheduled Sessions for a class.
 * Skips dates that already have a scheduled (non-cancelled) session same day.
 */
export function applyCourseScheduleToClass(
  state: SchedulingState,
  input: {
    classId: string
    course: Course
  },
): SchedulingResult<ScheduledSession[]> {
  const { classId, course } = input
  const schedule = normalizeCourseSchedule(course.schedule)
  if (!course.startsOn || !schedule) {
    return { ok: false, error: 'Course needs a start date and auto-schedule pattern' }
  }

  const plan = materializeCourseSchedule(course.startsOn, schedule)

  if (plan.occurrences.length === 0) {
    return { ok: false, error: 'No sessions generated from course schedule' }
  }

  // Key by full plannedStart so multi-time same day is allowed
  const existingStarts = new Set(
    state.scheduledSessions
      .filter((s) => s.classId === classId && s.status !== 'cancelled')
      .map((s) => s.plannedStart),
  )

  const created: ScheduledSession[] = []
  let next = state
  for (const occ of plan.occurrences) {
    if (existingStarts.has(occ.plannedStart)) continue
    const r = createScheduledSession(next, {
      classId,
      plannedStart: occ.plannedStart,
      durationMinutes: occ.durationMinutes,
      sessionNumber: occ.sequence + 1,
    })
    if (!r.ok) return r
    next = r.state
    const row = r.state.scheduledSessions.find((s) => s.plannedStart === occ.plannedStart)
    if (row) created.push(row)
    existingStarts.add(occ.plannedStart)
  }

  next = reindexSessionNumbers(next, classId)
  return { ok: true, value: created, state: next }
}

export function cancelScheduledSession(
  state: SchedulingState,
  scheduledSessionId: string,
): SchedulingResult<ScheduledSession> {
  const session = state.scheduledSessions.find((s) => s.id === scheduledSessionId)
  if (!session) return { ok: false, error: 'Scheduled session not found' }
  if (session.status === 'completed') {
    return { ok: false, error: 'Cannot cancel a completed occurrence' }
  }
  const updated: ScheduledSession = { ...session, status: 'cancelled' }
  return {
    ok: true,
    value: updated,
    state: {
      ...state,
      scheduledSessions: state.scheduledSessions.map((s) =>
        s.id === scheduledSessionId ? updated : s,
      ),
    },
  }
}

/**
 * Hard-delete a planned slot from the class list.
 * Blocks if a learning session already ran (or is open) against this schedule id.
 * Cancelled / rescheduled / pure scheduled slots without live history can be removed.
 */
export function deleteScheduledSession(
  state: SchedulingState,
  scheduledSessionId: string,
): SchedulingResult<{ deletedId: string }> {
  const session = state.scheduledSessions.find((s) => s.id === scheduledSessionId)
  if (!session) return { ok: false, error: 'Scheduled session not found' }

  const linked = state.learningSessions.find((ls) => ls.scheduledSessionId === scheduledSessionId)
  if (linked) {
    return {
      ok: false,
      error:
        linked.status === 'open'
          ? 'Finish or abandon the live session before deleting this slot'
          : 'Cannot delete — a completed live session is linked (cancel is not enough; keep history)',
    }
  }

  if (session.status === 'completed') {
    return { ok: false, error: 'Cannot delete a completed schedule row' }
  }

  const classId = session.classId
  const removed: SchedulingState = {
    ...state,
    scheduledSessions: state.scheduledSessions.filter((s) => s.id !== scheduledSessionId),
  }
  const reindexed = reindexSessionNumbers(removed, classId)
  return { ok: true, value: { deletedId: scheduledSessionId }, state: reindexed }
}

/**
 * Reschedule: mark original as rescheduled; create replacement linked back.
 * Original planned start is never rewritten.
 */
export function rescheduleSession(
  state: SchedulingState,
  scheduledSessionId: string,
  newPlannedStart: string,
): SchedulingResult<{ original: ScheduledSession; replacement: ScheduledSession }> {
  const original = state.scheduledSessions.find((s) => s.id === scheduledSessionId)
  if (!original) return { ok: false, error: 'Scheduled session not found' }
  if (original.status !== 'scheduled') {
    return { ok: false, error: 'Only future scheduled occurrences can be rescheduled' }
  }

  const marked: ScheduledSession = { ...original, status: 'rescheduled' }
  const replacement: ScheduledSession = {
    id: newId('sched'),
    classId: original.classId,
    plannedStart: newPlannedStart,
    durationMinutes: original.durationMinutes,
    status: 'scheduled',
    rescheduledFromId: original.id,
    sessionNumber: original.sessionNumber,
  }

  const nextState = reindexSessionNumbers(
    {
      ...state,
      scheduledSessions: [
        ...state.scheduledSessions.map((s) => (s.id === original.id ? marked : s)),
        replacement,
      ],
    },
    original.classId,
  )
  const replacementFinal =
    nextState.scheduledSessions.find((s) => s.id === replacement.id) ?? replacement

  return {
    ok: true,
    value: { original: marked, replacement: replacementFinal },
    state: nextState,
  }
}

/**
 * Start a Learning Session from a Scheduled Session (or ad-hoc).
 * Planned start on the schedule row is unchanged.
 */
export function startLearningSession(
  state: SchedulingState,
  input: {
    classId: string
    scheduledSessionId?: string | null
    at?: string
    maxProbeCount?: number
    plannedQuestionCount?: number | null
  },
): SchedulingResult<LearningSession> {
  const at = input.at ?? new Date().toISOString()
  let scheduledSessionId = input.scheduledSessionId ?? null

  if (scheduledSessionId) {
    const scheduled = state.scheduledSessions.find((s) => s.id === scheduledSessionId)
    if (!scheduled) return { ok: false, error: 'Scheduled session not found' }
    if (scheduled.status === 'cancelled' || scheduled.status === 'rescheduled') {
      return { ok: false, error: 'Cannot start a cancelled or rescheduled occurrence' }
    }
    const existing = state.learningSessions.find(
      (ls) => ls.scheduledSessionId === scheduledSessionId && ls.status === 'open',
    )
    if (existing) {
      return { ok: false, error: 'Learning Session already started for this occurrence' }
    }
  }

  const openForClass = state.learningSessions.find(
    (ls) => ls.classId === input.classId && ls.status === 'open',
  )
  if (openForClass) {
    return { ok: false, error: 'Class already has an open Learning Session' }
  }

  let sessionNumber: number | null = null
  if (scheduledSessionId) {
    const scheduled = state.scheduledSessions.find((s) => s.id === scheduledSessionId)
    sessionNumber = scheduled?.sessionNumber ?? null
  }
  if (sessionNumber == null) {
    const maxN = state.scheduledSessions
      .filter((s) => s.classId === input.classId && s.sessionNumber != null)
      .reduce((m, s) => Math.max(m, s.sessionNumber ?? 0), 0)
    const adHocCount = state.learningSessions.filter(
      (ls) => ls.classId === input.classId && !ls.scheduledSessionId,
    ).length
    sessionNumber = maxN > 0 ? maxN + adHocCount + 1 : adHocCount + 1
  }

  const session: LearningSession = {
    id: newId('ls'),
    classId: input.classId,
    scheduledSessionId,
    status: 'open',
    plannedQuestionCount: input.plannedQuestionCount ?? null,
    startedAt: at,
    completedAt: null,
    maxProbeCount: input.maxProbeCount ?? 2,
    sessionNumber,
  }

  return {
    ok: true,
    value: session,
    state: {
      ...state,
      learningSessions: [...state.learningSessions, session],
    },
  }
}

export function recordAttendance(
  state: SchedulingState,
  input: {
    learningSessionId: string
    learnerUserId: string
    status: AttendanceStatus
    at?: string
  },
): SchedulingResult<AttendanceRecord> {
  const session = state.learningSessions.find((s) => s.id === input.learningSessionId)
  if (!session) return { ok: false, error: 'Learning Session not found' }
  if (session.status === 'completed') {
    return { ok: false, error: 'Cannot change attendance on completed session' }
  }

  const existing = state.attendance.find(
    (a) =>
      a.learningSessionId === input.learningSessionId && a.learnerUserId === input.learnerUserId,
  )
  const record: AttendanceRecord = {
    id: existing?.id ?? newId('att'),
    learningSessionId: input.learningSessionId,
    learnerUserId: input.learnerUserId,
    status: input.status,
    recordedAt: input.at ?? new Date().toISOString(),
  }

  const attendance = existing
    ? state.attendance.map((a) => (a.id === existing.id ? record : a))
    : [...state.attendance, record]

  return { ok: true, value: record, state: { ...state, attendance } }
}

export function completeLearningSession(
  state: SchedulingState,
  learningSessionId: string,
  expectedLearnerIds: string[],
  at = new Date().toISOString(),
): SchedulingResult<LearningSession> {
  const session = state.learningSessions.find((s) => s.id === learningSessionId)
  if (!session) return { ok: false, error: 'Learning Session not found' }
  if (session.status === 'completed') {
    return { ok: false, error: 'Session already completed' }
  }

  for (const learnerId of expectedLearnerIds) {
    const has = state.attendance.some(
      (a) => a.learningSessionId === learningSessionId && a.learnerUserId === learnerId,
    )
    if (!has) {
      return {
        ok: false,
        error: `Missing attendance for learner ${learnerId}`,
      }
    }
  }

  const completed: LearningSession = {
    ...session,
    status: 'completed',
    completedAt: at,
  }

  let scheduledSessions = state.scheduledSessions
  if (session.scheduledSessionId) {
    scheduledSessions = state.scheduledSessions.map((s) =>
      s.id === session.scheduledSessionId ? { ...s, status: 'completed' as const } : s,
    )
  }

  return {
    ok: true,
    value: completed,
    state: {
      ...state,
      learningSessions: state.learningSessions.map((s) =>
        s.id === learningSessionId ? completed : s,
      ),
      scheduledSessions,
    },
  }
}
