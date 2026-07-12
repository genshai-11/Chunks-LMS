import { describe, expect, it } from 'vitest'
import { createSeedRoster } from './seed'
import {
  assignTeacher,
  createClass,
  createCourse,
  endEnrollment,
  enrollLearner,
  activeEnrollmentsForClass,
  addLearnerProfile,
  createLearnerAndEnroll,
  learnersAvailableForClass,
  updateCourse,
  archiveCourse,
  deleteCourse,
  updateClass,
  endClass,
  deleteClass,
  updateUserProfile,
  deleteUserProfile,
  deleteEnrollment,
  learnerInviteUrl,
  learnerInviteMailto,
  formatClassInviteClipboard,
  isLearnerEmailTaken,
} from './service'

describe('admin roster workflows', () => {
  it('creates a course available for class creation', () => {
    const seed = createSeedRoster()
    const result = createCourse(seed, {
      code: 'ERE-Level-A',
      name: 'ERE Level A',
      startsOn: '2026-07-01',
      endsOn: '2026-12-31',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.code).toBe('ERE-Level-A')
    expect(result.state.courses).toHaveLength(2)
  })

  it('updates and archives a course; deletes only without classes', () => {
    let state = createSeedRoster()
    const courseId = state.courses[0]!.id
    const updated = updateCourse(state, courseId, { name: 'ERE Level B+' })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    state = updated.state
    expect(state.courses[0]!.name).toBe('ERE Level B+')

    const blocked = deleteCourse(state, courseId)
    expect(blocked.ok).toBe(false)

    const archived = archiveCourse(state, courseId)
    expect(archived.ok).toBe(true)
    if (!archived.ok) return
    expect(archived.value.status).toBe('archived')

    const empty = createCourse(createSeedRoster(), {
      code: 'TMP',
      name: 'Temporary',
    })
    expect(empty.ok).toBe(true)
    if (!empty.ok) return
    const del = deleteCourse(empty.state, empty.value.id)
    expect(del.ok).toBe(true)
    if (!del.ok) return
    expect(del.state.courses.find((c) => c.id === empty.value.id)).toBeUndefined()
  })

  it('rejects dual active teacher assignment without replace', () => {
    const seed = createSeedRoster()
    const withTeacher = addTeacher(seed)
    const classId = withTeacher.classes[0]!.id
    const otherTeacher = withTeacher.users.find(
      (u) => u.roles.includes('teacher') && u.id !== withTeacher.classes[0]!.teacherUserId,
    )!
    const result = assignTeacher(withTeacher, classId, otherTeacher.id)
    expect(result.ok).toBe(false)
  })

  it('rejects enrollment over capacity and preserves ended enrollment history', () => {
    let state = createSeedRoster()
    const classId = state.classes[0]!.id
    expect(activeEnrollmentsForClass(state, classId)).toHaveLength(3)

    const extra = addLearnerProfile(state, { displayName: 'Learner Four' })
    expect(extra.ok).toBe(true)
    if (!extra.ok) return
    state = extra.state

    const over = enrollLearner(state, classId, extra.value.id)
    expect(over.ok).toBe(false)

    const firstEnr = state.enrollments.find((e) => e.classId === classId)!
    const ended = endEnrollment(state, firstEnr.id, '2026-08-01T00:00:00.000Z')
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    state = ended.state
    expect(state.enrollments.find((e) => e.id === firstEnr.id)?.status).toBe('ended')
    expect(state.enrollments.find((e) => e.id === firstEnr.id)?.endedAt).toBe(
      '2026-08-01T00:00:00.000Z',
    )

    // Learner profile remains
    expect(state.users.some((u) => u.id === firstEnr.learnerUserId)).toBe(true)

    // Seat freed — can enroll another
    const ok = enrollLearner(state, classId, extra.value.id)
    expect(ok.ok).toBe(true)
    if (!ok.ok) return

    // Cannot purge an active enrollment
    const purgeActive = deleteEnrollment(ok.state, ok.value.id)
    expect(purgeActive.ok).toBe(false)

    // After ending, history row may be deleted
    const endedExtra = endEnrollment(ok.state, ok.value.id)
    expect(endedExtra.ok).toBe(true)
    if (!endedExtra.ok) return
    const purgeEnded = deleteEnrollment(endedExtra.state, ok.value.id)
    expect(purgeEnded.ok).toBe(true)
  })

  it('creates class under active course with capacity and single teacher', () => {
    const seed = createSeedRoster()
    const teacherId = seed.users.find((u) => u.roles.includes('teacher'))!.id
    const result = createClass(seed, {
      courseId: seed.courses[0]!.id,
      name: 'Class B-2',
      teacherUserId: teacherId,
      capacity: 3,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.teacherUserId).toBe(teacherId)
    expect(result.value.capacity).toBe(3)
  })

  it('updates class, ends class (ends enrollments), blocks unsafe delete', () => {
    let state = createSeedRoster()
    const classId = state.classes[0]!.id
    const updated = updateClass(state, classId, { name: 'Class B-1+', capacity: 4 })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    state = updated.state
    expect(state.classes[0]!.name).toBe('Class B-1+')

    const tooSmall = updateClass(state, classId, { capacity: 1 })
    expect(tooSmall.ok).toBe(false)

    const blocked = deleteClass(state, classId)
    expect(blocked.ok).toBe(false)

    const ended = endClass(state, classId)
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.value.status).toBe('ended')
    expect(activeEnrollmentsForClass(ended.state, classId)).toHaveLength(0)
  })

  it('creates a learner and enrolls them into a class in one step', () => {
    let state = createSeedRoster()
    const classId = state.classes[0]!.id
    // Free one seat first
    const first = state.enrollments.find((e) => e.classId === classId && e.status === 'active')!
    const freed = endEnrollment(state, first.id)
    expect(freed.ok).toBe(true)
    if (!freed.ok) return
    state = freed.state

    const before = activeEnrollmentsForClass(state, classId).length
    const result = createLearnerAndEnroll(state, classId, {
      displayName: 'Quick Student',
      email: 'quick@example.com',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.learner.displayName).toBe('Quick Student')
    expect(result.value.enrollment.classId).toBe(classId)
    expect(result.value.enrollment.status).toBe('active')
    expect(activeEnrollmentsForClass(result.state, classId)).toHaveLength(before + 1)
    expect(
      learnersAvailableForClass(result.state, classId).some((u) => u.id === result.value.learner.id),
    ).toBe(false)
  })

  it('rejects createLearnerAndEnroll when class is full', () => {
    const seed = createSeedRoster()
    const classId = seed.classes[0]!.id
    const full = createLearnerAndEnroll(seed, classId, { displayName: 'Overflow' })
    expect(full.ok).toBe(false)
  })

  it('updates people and blocks deleting linked users', () => {
    let state = createSeedRoster()
    const teacher = state.users.find((u) => u.roles.includes('teacher'))!
    const learner = state.users.find((u) => u.roles.includes('learner'))!

    const renamed = updateUserProfile(state, teacher.id, { displayName: 'Lead Teacher' })
    expect(renamed.ok).toBe(true)
    if (!renamed.ok) return
    state = renamed.state
    expect(state.users.find((u) => u.id === teacher.id)?.displayName).toBe('Lead Teacher')

    expect(deleteUserProfile(state, teacher.id).ok).toBe(false)
    expect(deleteUserProfile(state, learner.id).ok).toBe(false)

    const orphan = addLearnerProfile(state, { displayName: 'Orphan' })
    expect(orphan.ok).toBe(true)
    if (!orphan.ok) return
    const gone = deleteUserProfile(orphan.state, orphan.value.id)
    expect(gone.ok).toBe(true)
  })

  it('builds share-link invites and enforces unique learner emails', () => {
    const seed = createSeedRoster()
    const learner = seed.users.find((u) => u.roles.includes('learner') && u.email)!
    const url = learnerInviteUrl(learner, 'https://lms.example')
    expect(url).toBe(
      `https://lms.example/access?email=${encodeURIComponent(learner.email!)}`,
    )
    const mailto = learnerInviteMailto(learner, 'https://lms.example')
    expect(mailto).toContain('mailto:')
    expect(mailto).toContain(encodeURIComponent(url!))

    const classId = seed.classes[0]!.id
    const clip = formatClassInviteClipboard(seed, classId, 'https://lms.example')
    expect(clip.split('\n').length).toBeGreaterThanOrEqual(1)
    expect(clip).toContain('/access?email=')

    expect(isLearnerEmailTaken(seed, learner.email)).toBe(true)
    expect(isLearnerEmailTaken(seed, learner.email, learner.id)).toBe(false)

    const dup = addLearnerProfile(seed, {
      displayName: 'Copycat',
      email: learner.email!.toUpperCase(),
    })
    expect(dup.ok).toBe(false)
  })
})

function addTeacher(state: ReturnType<typeof createSeedRoster>) {
  return {
    ...state,
    users: [
      ...state.users,
      {
        id: 'teacher-2',
        displayName: 'Second Teacher',
        email: 't2@example.com',
        avatarUrl: null,
        roles: ['teacher' as const],
        accountStatus: 'active' as const,
      },
    ],
  }
}
