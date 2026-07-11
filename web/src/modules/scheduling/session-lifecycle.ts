import { newId } from '../roster/seed'
import type { Course } from '../roster/types'
import { materializeSessionCount } from './recurrence'
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

export function createScheduledSession(
  state: SchedulingState,
  input: {
    classId: string
    plannedStart: string
    durationMinutes: number
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
  }
  return {
    ok: true,
    value: session,
    state: {
      ...state,
      scheduledSessions: [...state.scheduledSessions, session],
    },
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
  if (!course.startsOn || !course.schedule) {
    return { ok: false, error: 'Course needs a start date and auto-schedule pattern' }
  }

  const plan = materializeSessionCount({
    startDate: course.startsOn,
    weekdays: course.schedule.weekdays,
    sessionCount: course.schedule.sessionCount,
    startTime: course.schedule.startTime,
    timeZone: course.schedule.timeZone,
    durationMinutes: course.schedule.durationMinutes,
  })

  if (plan.occurrences.length === 0) {
    return { ok: false, error: 'No sessions generated from course schedule' }
  }

  const existingDates = new Set(
    state.scheduledSessions
      .filter((s) => s.classId === classId && s.status !== 'cancelled')
      .map((s) => s.plannedStart.slice(0, 10)),
  )

  const created: ScheduledSession[] = []
  let next = state
  for (const occ of plan.occurrences) {
    if (existingDates.has(occ.plannedStartDate)) continue
    const r = createScheduledSession(next, {
      classId,
      plannedStart: occ.plannedStart,
      durationMinutes: occ.durationMinutes,
    })
    if (!r.ok) return r
    next = r.state
    created.push(r.value)
    existingDates.add(occ.plannedStartDate)
  }

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
  }

  return {
    ok: true,
    value: { original: marked, replacement },
    state: {
      ...state,
      scheduledSessions: [
        ...state.scheduledSessions.map((s) => (s.id === original.id ? marked : s)),
        replacement,
      ],
    },
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

  const session: LearningSession = {
    id: newId('ls'),
    classId: input.classId,
    scheduledSessionId,
    status: 'open',
    plannedQuestionCount: input.plannedQuestionCount ?? null,
    startedAt: at,
    completedAt: null,
    maxProbeCount: input.maxProbeCount ?? 2,
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
