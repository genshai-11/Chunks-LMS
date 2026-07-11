export type CourseStatus = 'active' | 'archived'
export type ClassStatus = 'active' | 'ended'
export type EnrollmentStatus = 'active' | 'ended'

export type Organization = {
  id: string
  name: string
}

export type DomainUser = {
  id: string
  displayName: string
  email: string | null
  /** Optional image URL or data URL for avatar */
  avatarUrl: string | null
  roles: Array<'admin' | 'teacher' | 'learner'>
}

/** Weekly meeting pattern for auto-scheduling (0=Sun … 6=Sat). */
export type CourseSchedule = {
  /** e.g. [2, 3] = Tuesday + Wednesday */
  weekdays: number[]
  /** Local start time HH:mm */
  startTime: string
  durationMinutes: number
  /** Number of class meetings (default 15) */
  sessionCount: number
  timeZone: string
}

export type Course = {
  id: string
  organizationId: string
  code: string
  name: string
  status: CourseStatus
  startsOn: string | null
  /** Auto-filled from start + schedule when using auto-schedule */
  endsOn: string | null
  schedule: CourseSchedule | null
}

export type Class = {
  id: string
  courseId: string
  name: string
  capacity: number
  teacherUserId: string
  status: ClassStatus
}

export type Enrollment = {
  id: string
  classId: string
  learnerUserId: string
  status: EnrollmentStatus
  startedAt: string
  endedAt: string | null
}

export type RosterState = {
  organization: Organization
  users: DomainUser[]
  courses: Course[]
  classes: Class[]
  enrollments: Enrollment[]
}

export type RosterResult<T> = { ok: true; value: T; state: RosterState } | { ok: false; error: string }
