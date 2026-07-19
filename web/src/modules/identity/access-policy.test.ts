import { describe, expect, it } from 'vitest'
import {
  canCaptureAssessment,
  canManageWorkspaceCatalog,
  canReadClass,
  canReadEnrollment,
  canReadLearnerAssessment,
  canReadWorkspace,
  filterVisible,
  type PolicyActor,
} from './access-policy'

const now = '2026-07-19T02:48:00.000Z'

const admin: PolicyActor = {
  kind: 'staff',
  userId: 'admin-1',
  roles: ['admin', 'teacher'],
  ownedClassIds: [],
}

const teacherA: PolicyActor = {
  kind: 'staff',
  userId: 'teacher-a',
  roles: ['teacher'],
  ownedClassIds: ['class-a'],
}

const teacherB: PolicyActor = {
  kind: 'staff',
  userId: 'teacher-b',
  roles: ['teacher'],
  ownedClassIds: ['class-b'],
}

const learnerToken: PolicyActor = {
  kind: 'learner-token',
  learnerUserId: 'learner-1',
  classId: 'class-a',
  expiresAt: '2026-07-20T00:00:00.000Z',
}

const expiredLearnerToken: PolicyActor = {
  kind: 'learner-token',
  learnerUserId: 'learner-1',
  classId: 'class-a',
  expiresAt: '2026-07-18T00:00:00.000Z',
}

const revokedLearnerToken: PolicyActor = {
  kind: 'learner-token',
  learnerUserId: 'learner-1',
  classId: 'class-a',
  expiresAt: '2026-07-20T00:00:00.000Z',
  revokedAt: '2026-07-19T00:00:00.000Z',
}

const anon: PolicyActor = { kind: 'anon' }

const learnerRow = {
  learnerUserId: 'learner-1',
  teacherUserId: 'teacher-a',
  classId: 'class-a',
}

const otherLearnerRow = {
  learnerUserId: 'learner-2',
  teacherUserId: 'teacher-a',
  classId: 'class-a',
}

const otherClassRow = {
  learnerUserId: 'learner-1',
  teacherUserId: 'teacher-b',
  classId: 'class-b',
}

describe('V2 RLS-equivalent access policy', () => {
  it('uses database-owned staff roles instead of user-editable metadata or org membership', () => {
    expect(canReadWorkspace(admin)).toBe(true)
    expect(canManageWorkspaceCatalog(admin)).toBe(true)
    expect(canManageWorkspaceCatalog(teacherA)).toBe(false)
    expect(canReadWorkspace(anon)).toBe(false)
  })

  it('scopes Teacher through owned Classes', () => {
    expect(canReadClass(teacherA, { classId: 'class-a' })).toBe(true)
    expect(canReadClass(teacherA, { classId: 'class-b' })).toBe(false)
    expect(canCaptureAssessment(teacherA, { classId: 'class-a', teacherUserId: 'teacher-a', learnerUserIds: ['learner-1'] })).toBe(true)
    expect(canCaptureAssessment(teacherB, { classId: 'class-a', teacherUserId: 'teacher-a', learnerUserIds: ['learner-1'] })).toBe(false)
  })

  it('allows a valid signed learner token to read only its learner and class scope', () => {
    expect(canReadEnrollment(learnerToken, learnerRow)).toBe(true)
    expect(canReadLearnerAssessment(learnerToken, learnerRow, now)).toBe(true)
    expect(canReadLearnerAssessment(learnerToken, otherLearnerRow, now)).toBe(false)
    expect(canReadLearnerAssessment(learnerToken, otherClassRow, now)).toBe(false)
  })

  it('denies expired, revoked, and anonymous learner access', () => {
    expect(canReadLearnerAssessment(expiredLearnerToken, learnerRow, now)).toBe(false)
    expect(canReadLearnerAssessment(revokedLearnerToken, learnerRow, now)).toBe(false)
    expect(canReadLearnerAssessment(anon, learnerRow, now)).toBe(false)
  })

  it('filters collections so only authorized learner rows remain', () => {
    const visible = filterVisible(
      [learnerRow, otherLearnerRow, otherClassRow],
      learnerToken,
      (actor, row) => canReadLearnerAssessment(actor, row, now),
    )
    expect(visible).toEqual([learnerRow])
  })
})
