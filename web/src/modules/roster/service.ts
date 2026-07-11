import { materializeCourseSchedule } from '../scheduling/recurrence'
import { canEnroll, DEFAULT_CLASS_CAPACITY } from './capacity'
import { normalizeCourseSchedule } from './schedule'
import { newId } from './seed'
import type {
  Class,
  Course,
  CourseSchedule,
  DomainUser,
  Enrollment,
  RosterResult,
  RosterState,
} from './types'

export { defaultCourseSchedule } from './schedule'
export {
  formatScheduleLabel,
  formatWeekdaysLabel,
  normalizeCourseSchedule,
} from './schedule'

export function listTeachers(state: RosterState): DomainUser[] {
  return state.users.filter((u) => u.roles.includes('teacher'))
}

export function listLearners(state: RosterState): DomainUser[] {
  return state.users.filter((u) => u.roles.includes('learner'))
}

export function findLearnerByEmail(
  state: RosterState,
  email: string,
): DomainUser | null {
  const needle = email.trim().toLowerCase()
  if (!needle) return null
  return (
    state.users.find(
      (u) => u.roles.includes('learner') && (u.email ?? '').toLowerCase() === needle,
    ) ?? null
  )
}

export function activeEnrollmentsForClass(state: RosterState, classId: string): Enrollment[] {
  return state.enrollments.filter((e) => e.classId === classId && e.status === 'active')
}

function resolveCourseDates(input: {
  startsOn?: string | null
  endsOn?: string | null
  schedule?: CourseSchedule | null
}): { startsOn: string | null; endsOn: string | null; schedule: CourseSchedule | null } {
  const schedule = normalizeCourseSchedule(input.schedule ?? null)
  const startsOn = input.startsOn ?? null

  if (schedule && startsOn && schedule.slots.length > 0 && schedule.sessionCount > 0) {
    const plan = materializeCourseSchedule(startsOn, schedule)
    return {
      startsOn,
      endsOn: plan.endsOn ?? input.endsOn ?? null,
      schedule,
    }
  }

  return {
    startsOn,
    endsOn: input.endsOn ?? null,
    schedule,
  }
}

export function createCourse(
  state: RosterState,
  input: {
    code: string
    name: string
    startsOn?: string | null
    endsOn?: string | null
    schedule?: CourseSchedule | null
  },
): RosterResult<Course> {
  const code = input.code.trim()
  const name = input.name.trim()
  if (!code || !name) return { ok: false, error: 'Course code and name are required' }
  if (state.courses.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
    return { ok: false, error: `Course code ${code} already exists` }
  }

  const normalizedSchedule = normalizeCourseSchedule(input.schedule ?? null)
  if (input.schedule && (!normalizedSchedule || normalizedSchedule.slots.length === 0)) {
    return { ok: false, error: 'Add at least one day and time for auto-schedule' }
  }
  if (normalizedSchedule && normalizedSchedule.sessionCount < 1) {
    return { ok: false, error: 'Session count must be at least 1' }
  }

  const dates = resolveCourseDates({
    startsOn: input.startsOn ?? null,
    endsOn: input.endsOn ?? null,
    schedule: normalizedSchedule,
  })

  const course: Course = {
    id: newId('course'),
    organizationId: state.organization.id,
    code,
    name,
    status: 'active',
    startsOn: dates.startsOn,
    endsOn: dates.endsOn,
    schedule: dates.schedule,
  }

  return {
    ok: true,
    value: course,
    state: { ...state, courses: [...state.courses, course] },
  }
}

export function updateCourse(
  state: RosterState,
  courseId: string,
  input: {
    code?: string
    name?: string
    status?: Course['status']
    startsOn?: string | null
    endsOn?: string | null
    schedule?: CourseSchedule | null
  },
): RosterResult<Course> {
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) return { ok: false, error: 'Course not found' }

  const code = input.code !== undefined ? input.code.trim() : course.code
  const name = input.name !== undefined ? input.name.trim() : course.name
  if (!code || !name) return { ok: false, error: 'Course code and name are required' }

  if (
    state.courses.some(
      (c) => c.id !== courseId && c.code.toLowerCase() === code.toLowerCase(),
    )
  ) {
    return { ok: false, error: `Course code ${code} already exists` }
  }

  const nextSchedule =
    input.schedule !== undefined
      ? normalizeCourseSchedule(input.schedule)
      : normalizeCourseSchedule(course.schedule)
  if (input.schedule !== undefined && input.schedule && (!nextSchedule || nextSchedule.slots.length === 0)) {
    return { ok: false, error: 'Add at least one day and time for auto-schedule' }
  }

  const dates = resolveCourseDates({
    startsOn: input.startsOn !== undefined ? input.startsOn : course.startsOn,
    endsOn: input.endsOn !== undefined ? input.endsOn : course.endsOn,
    schedule: nextSchedule,
  })

  const updated: Course = {
    ...course,
    code,
    name,
    status: input.status ?? course.status,
    startsOn: dates.startsOn,
    endsOn: dates.endsOn,
    schedule: dates.schedule,
  }

  return {
    ok: true,
    value: updated,
    state: {
      ...state,
      courses: state.courses.map((c) => (c.id === courseId ? updated : c)),
    },
  }
}

/** Preview auto end date + occurrence list for a course schedule. */
export function previewCourseSchedule(course: Pick<Course, 'startsOn' | 'schedule'>) {
  if (!course.startsOn || !course.schedule) {
    return { endsOn: null, occurrences: [], sessionCount: 0 }
  }
  const schedule = normalizeCourseSchedule(course.schedule)
  if (!schedule) return { endsOn: null, occurrences: [], sessionCount: 0 }
  return materializeCourseSchedule(course.startsOn, schedule)
}

/** Invite URL so a learner can open their portal by email. */
export function learnerInviteUrl(
  learner: DomainUser,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string | null {
  if (!learner.email?.trim()) return null
  const base = origin || ''
  return `${base}/access?email=${encodeURIComponent(learner.email.trim())}`
}

export function archiveCourse(state: RosterState, courseId: string): RosterResult<Course> {
  return updateCourse(state, courseId, { status: 'archived' })
}

export function restoreCourse(state: RosterState, courseId: string): RosterResult<Course> {
  return updateCourse(state, courseId, { status: 'active' })
}

/** Hard delete only when no classes reference the course. */
export function deleteCourse(state: RosterState, courseId: string): RosterResult<{ id: string }> {
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) return { ok: false, error: 'Course not found' }
  if (state.classes.some((c) => c.courseId === courseId)) {
    return {
      ok: false,
      error: 'Cannot delete course with classes; archive it or remove classes first',
    }
  }
  return {
    ok: true,
    value: { id: courseId },
    state: { ...state, courses: state.courses.filter((c) => c.id !== courseId) },
  }
}

export function createClass(
  state: RosterState,
  input: {
    courseId: string
    name: string
    teacherUserId: string
    capacity?: number
  },
): RosterResult<Class> {
  const course = state.courses.find((c) => c.id === input.courseId && c.status === 'active')
  if (!course) return { ok: false, error: 'Active course not found' }

  const teacher = state.users.find(
    (u) => u.id === input.teacherUserId && u.roles.includes('teacher'),
  )
  if (!teacher) return { ok: false, error: 'Teacher not found' }

  const capacity = input.capacity ?? DEFAULT_CLASS_CAPACITY
  if (capacity < 1) return { ok: false, error: 'Capacity must be a positive integer' }

  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Class name is required' }

  // V1: one teacher stored as teacherUserId — reassignment replaces, never dual active teachers.
  const klass: Class = {
    id: newId('class'),
    courseId: course.id,
    name,
    capacity,
    teacherUserId: teacher.id,
    status: 'active',
  }

  return {
    ok: true,
    value: klass,
    state: { ...state, classes: [...state.classes, klass] },
  }
}

export function updateClass(
  state: RosterState,
  classId: string,
  input: {
    courseId?: string
    name?: string
    teacherUserId?: string
    capacity?: number
    status?: Class['status']
  },
): RosterResult<Class> {
  const klass = state.classes.find((c) => c.id === classId)
  if (!klass) return { ok: false, error: 'Class not found' }

  const courseId = input.courseId ?? klass.courseId
  const course = state.courses.find((c) => c.id === courseId)
  if (!course) return { ok: false, error: 'Course not found' }
  if (course.status !== 'active' && courseId !== klass.courseId) {
    return { ok: false, error: 'Cannot move class to an archived course' }
  }

  const teacherUserId = input.teacherUserId ?? klass.teacherUserId
  const teacher = state.users.find(
    (u) => u.id === teacherUserId && u.roles.includes('teacher'),
  )
  if (!teacher) return { ok: false, error: 'Teacher not found' }

  const capacity = input.capacity ?? klass.capacity
  if (capacity < 1) return { ok: false, error: 'Capacity must be a positive integer' }

  const activeCount = activeEnrollmentsForClass(state, classId).length
  if (capacity < activeCount) {
    return {
      ok: false,
      error: `Capacity ${capacity} is below active enrollments (${activeCount})`,
    }
  }

  const name = input.name !== undefined ? input.name.trim() : klass.name
  if (!name) return { ok: false, error: 'Class name is required' }

  const updated: Class = {
    ...klass,
    courseId,
    name,
    capacity,
    teacherUserId,
    status: input.status ?? klass.status,
  }

  return {
    ok: true,
    value: updated,
    state: {
      ...state,
      classes: state.classes.map((c) => (c.id === classId ? updated : c)),
    },
  }
}

export function endClass(state: RosterState, classId: string): RosterResult<Class> {
  const klass = state.classes.find((c) => c.id === classId)
  if (!klass) return { ok: false, error: 'Class not found' }
  if (klass.status === 'ended') return { ok: true, value: klass, state }

  let next = state
  for (const e of activeEnrollmentsForClass(state, classId)) {
    const ended = endEnrollment(next, e.id)
    if (!ended.ok) return ended
    next = ended.state
  }

  return updateClass(next, classId, { status: 'ended' })
}

export function restoreClass(state: RosterState, classId: string): RosterResult<Class> {
  return updateClass(state, classId, { status: 'active' })
}

/** Hard delete only when no enrollments exist for the class. */
export function deleteClass(state: RosterState, classId: string): RosterResult<{ id: string }> {
  const klass = state.classes.find((c) => c.id === classId)
  if (!klass) return { ok: false, error: 'Class not found' }
  if (state.enrollments.some((e) => e.classId === classId)) {
    return {
      ok: false,
      error: 'Cannot delete class with enrollment history; end the class instead',
    }
  }
  return {
    ok: true,
    value: { id: classId },
    state: { ...state, classes: state.classes.filter((c) => c.id !== classId) },
  }
}

/**
 * Reject assigning a second concurrent teacher identity.
 * V1 model is single teacher_user_id; this guards explicit dual-teacher attempts.
 */
export function assignTeacher(
  state: RosterState,
  classId: string,
  teacherUserId: string,
  options?: { forceReplace?: boolean },
): RosterResult<Class> {
  const klass = state.classes.find((c) => c.id === classId)
  if (!klass || klass.status !== 'active') return { ok: false, error: 'Active class not found' }

  const teacher = state.users.find(
    (u) => u.id === teacherUserId && u.roles.includes('teacher'),
  )
  if (!teacher) return { ok: false, error: 'Teacher not found' }

  if (klass.teacherUserId === teacherUserId) {
    return { ok: true, value: klass, state }
  }

  if (!options?.forceReplace && klass.teacherUserId) {
    return {
      ok: false,
      error: 'Class already has an active Teacher; refuse dual assignment without replace',
    }
  }

  const updated: Class = { ...klass, teacherUserId }
  return {
    ok: true,
    value: updated,
    state: {
      ...state,
      classes: state.classes.map((c) => (c.id === classId ? updated : c)),
    },
  }
}

export function enrollLearner(
  state: RosterState,
  classId: string,
  learnerUserId: string,
  at = new Date().toISOString(),
): RosterResult<Enrollment> {
  const klass = state.classes.find((c) => c.id === classId && c.status === 'active')
  if (!klass) return { ok: false, error: 'Active class not found' }

  const learner = state.users.find(
    (u) => u.id === learnerUserId && u.roles.includes('learner'),
  )
  if (!learner) return { ok: false, error: 'Learner not found' }

  const existing = state.enrollments.find(
    (e) => e.classId === classId && e.learnerUserId === learnerUserId,
  )
  if (existing?.status === 'active') {
    return { ok: false, error: 'Learner is already enrolled' }
  }

  const activeCount = activeEnrollmentsForClass(state, classId).length
  const capacityCheck = canEnroll(activeCount, klass.capacity)
  if (!capacityCheck.ok) return { ok: false, error: capacityCheck.error }

  if (existing) {
    // Re-activate ended enrollment
    const reactivated: Enrollment = {
      ...existing,
      status: 'active',
      startedAt: at,
      endedAt: null,
    }
    return {
      ok: true,
      value: reactivated,
      state: {
        ...state,
        enrollments: state.enrollments.map((e) => (e.id === existing.id ? reactivated : e)),
      },
    }
  }

  const enrollment: Enrollment = {
    id: newId('enr'),
    classId,
    learnerUserId,
    status: 'active',
    startedAt: at,
    endedAt: null,
  }

  return {
    ok: true,
    value: enrollment,
    state: { ...state, enrollments: [...state.enrollments, enrollment] },
  }
}

export function endEnrollment(
  state: RosterState,
  enrollmentId: string,
  at = new Date().toISOString(),
): RosterResult<Enrollment> {
  const enrollment = state.enrollments.find((e) => e.id === enrollmentId)
  if (!enrollment) return { ok: false, error: 'Enrollment not found' }
  if (enrollment.status === 'ended') {
    return { ok: true, value: enrollment, state }
  }

  const ended: Enrollment = {
    ...enrollment,
    status: 'ended',
    endedAt: at,
  }

  // History preserved: row remains; learner profile untouched.
  return {
    ok: true,
    value: ended,
    state: {
      ...state,
      enrollments: state.enrollments.map((e) => (e.id === enrollmentId ? ended : e)),
    },
  }
}

export function addLearnerProfile(
  state: RosterState,
  input: { displayName: string; email?: string | null; avatarUrl?: string | null },
): RosterResult<DomainUser> {
  const displayName = input.displayName.trim()
  if (!displayName) return { ok: false, error: 'Learner name is required' }

  const user: DomainUser = {
    id: newId('user'),
    displayName,
    email: input.email?.trim() || null,
    avatarUrl: input.avatarUrl ?? null,
    roles: ['learner'],
  }

  return {
    ok: true,
    value: user,
    state: { ...state, users: [...state.users, user] },
  }
}

/**
 * Create a learner profile and seat them in a class in one step
 * (admin workflow from Courses/Classes — no separate People → Enrollments hop).
 */
export function createLearnerAndEnroll(
  state: RosterState,
  classId: string,
  input: { displayName: string; email?: string | null; avatarUrl?: string | null },
  at = new Date().toISOString(),
): RosterResult<{ learner: DomainUser; enrollment: Enrollment }> {
  const created = addLearnerProfile(state, input)
  if (!created.ok) return created

  const enrolled = enrollLearner(created.state, classId, created.value.id, at)
  if (!enrolled.ok) return enrolled

  return {
    ok: true,
    value: { learner: created.value, enrollment: enrolled.value },
    state: enrolled.state,
  }
}

/** Learners not currently active in this class (available to enroll). */
export function learnersAvailableForClass(state: RosterState, classId: string): DomainUser[] {
  const activeIds = new Set(
    activeEnrollmentsForClass(state, classId).map((e) => e.learnerUserId),
  )
  return listLearners(state).filter((u) => !activeIds.has(u.id))
}

export function addTeacherProfile(
  state: RosterState,
  input: { displayName: string; email?: string | null; avatarUrl?: string | null },
): RosterResult<DomainUser> {
  const displayName = input.displayName.trim()
  if (!displayName) return { ok: false, error: 'Teacher name is required' }

  const user: DomainUser = {
    id: newId('user'),
    displayName,
    email: input.email?.trim() || null,
    avatarUrl: input.avatarUrl ?? null,
    roles: ['teacher'],
  }

  return {
    ok: true,
    value: user,
    state: { ...state, users: [...state.users, user] },
  }
}

export function updateUserProfile(
  state: RosterState,
  userId: string,
  input: {
    displayName?: string
    email?: string | null
    avatarUrl?: string | null
  },
): RosterResult<DomainUser> {
  const user = state.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'User not found' }

  const displayName =
    input.displayName !== undefined ? input.displayName.trim() : user.displayName
  if (!displayName) return { ok: false, error: 'Name is required' }

  const updated: DomainUser = {
    ...user,
    displayName,
    email: input.email !== undefined ? input.email?.trim() || null : user.email,
    avatarUrl:
      input.avatarUrl !== undefined ? input.avatarUrl || null : user.avatarUrl,
  }

  return {
    ok: true,
    value: updated,
    state: {
      ...state,
      users: state.users.map((u) => (u.id === userId ? updated : u)),
    },
  }
}

/**
 * Remove a person only when they are not teaching an active class
 * and have no enrollment history (active or ended).
 */
export function deleteUserProfile(
  state: RosterState,
  userId: string,
): RosterResult<{ id: string }> {
  const user = state.users.find((u) => u.id === userId)
  if (!user) return { ok: false, error: 'User not found' }

  if (state.classes.some((c) => c.teacherUserId === userId && c.status === 'active')) {
    return { ok: false, error: 'Cannot delete teacher assigned to an active class' }
  }
  if (state.enrollments.some((e) => e.learnerUserId === userId)) {
    return {
      ok: false,
      error: 'Cannot delete learner with enrollment history; end enrollments and keep profile',
    }
  }
  // Soft block: still teaching ended classes is ok to delete only if we reassign — keep simple:
  if (state.classes.some((c) => c.teacherUserId === userId)) {
    return {
      ok: false,
      error: 'Cannot delete teacher still linked to a class; reassign first',
    }
  }

  return {
    ok: true,
    value: { id: userId },
    state: { ...state, users: state.users.filter((u) => u.id !== userId) },
  }
}

export function deleteEnrollment(
  state: RosterState,
  enrollmentId: string,
): RosterResult<{ id: string }> {
  const enrollment = state.enrollments.find((e) => e.id === enrollmentId)
  if (!enrollment) return { ok: false, error: 'Enrollment not found' }
  if (enrollment.status === 'active') {
    return { ok: false, error: 'End the enrollment before deleting history' }
  }
  return {
    ok: true,
    value: { id: enrollmentId },
    state: {
      ...state,
      enrollments: state.enrollments.filter((e) => e.id !== enrollmentId),
    },
  }
}
