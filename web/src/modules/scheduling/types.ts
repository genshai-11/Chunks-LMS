export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled' | 'rescheduled'
export type LearningSessionStatus = 'open' | 'completed'
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export type ScheduledSession = {
  id: string
  classId: string
  plannedStart: string
  durationMinutes: number
  status: ScheduleStatus
  rescheduledFromId: string | null
  /**
   * 1-based buổi index within the class course plan (e.g. 1..15).
   * Null for ad-hoc slots until reindexed.
   */
  sessionNumber: number | null
}

export type LearningSession = {
  id: string
  classId: string
  scheduledSessionId: string | null
  status: LearningSessionStatus
  plannedQuestionCount: number | null
  startedAt: string
  completedAt: string | null
  maxProbeCount: number
  /** Inherited from scheduled session or assigned when started */
  sessionNumber: number | null
  /**
   * Soft lock: teacher currently authorized to capture for an open session.
   * Null when unlocked / expired (see lockExpiresAt).
   */
  ownerUserId: string | null
  /** ISO expiry for ownerUserId lock; null means no active lock. */
  lockExpiresAt: string | null
}

export type AttendanceRecord = {
  id: string
  learningSessionId: string
  learnerUserId: string
  status: AttendanceStatus
  recordedAt: string
}

export type SchedulingState = {
  scheduledSessions: ScheduledSession[]
  learningSessions: LearningSession[]
  attendance: AttendanceRecord[]
}
