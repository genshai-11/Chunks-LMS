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
