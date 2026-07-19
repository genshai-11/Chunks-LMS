/**
 * Application-level mirror of deny-by-default RLS rules.
 * Live Postgres RLS remains authoritative; these predicates are unit-tested
 * to prove staff role, teacher-class, and signed learner-token isolation intent.
 */

export type StaffRole = 'admin' | 'teacher'

export type StaffPolicyActor = {
  kind: 'staff'
  userId: string
  roles: StaffRole[]
  ownedClassIds: string[]
}

export type LearnerTokenPolicyActor = {
  kind: 'learner-token'
  learnerUserId: string
  classId: string | null
  expiresAt: string
  revokedAt?: string | null
}

export type AnonPolicyActor = { kind: 'anon' }

/** Legacy app mirror shape retained for older local tests/callers during V2 cutover. */
export type LegacyPolicyActor = {
  userId: string
  organizationIds: string[]
  rolesByOrg: Record<string, Array<'admin' | 'teacher' | 'learner' | string>>
}

export type PolicyActor = StaffPolicyActor | LearnerTokenPolicyActor | AnonPolicyActor | LegacyPolicyActor

export type OrgScoped = { organizationId: string }
export type WorkspaceScoped = Record<string, never>
export type ClassScoped = { classId?: string; organizationId?: string; teacherUserId: string; learnerUserIds: string[] }
export type LearnerOwned = { learnerUserId: string; teacherUserId: string; classId?: string; organizationId?: string }

function isLegacy(actor: PolicyActor): actor is LegacyPolicyActor {
  return !('kind' in actor)
}

export function isOrgMember(actor: PolicyActor, organizationId: string): boolean {
  if (isLegacy(actor)) return actor.organizationIds.includes(organizationId)
  return actor.kind === 'staff'
}

export function hasOrgRole(
  actor: PolicyActor,
  organizationId: string,
  role: 'admin' | 'teacher' | 'learner',
): boolean {
  if (isLegacy(actor)) return actor.rolesByOrg[organizationId]?.includes(role) ?? false
  if (actor.kind !== 'staff') return false
  if (role === 'teacher') return actor.roles.includes('teacher') || actor.roles.includes('admin')
  return actor.roles.includes(role as StaffRole)
}

export function isAdmin(actor: PolicyActor): boolean {
  if (isLegacy(actor)) return Object.entries(actor.rolesByOrg).some(([orgId]) => hasOrgRole(actor, orgId, 'admin'))
  return actor.kind === 'staff' && actor.roles.includes('admin')
}

export function isTeacherForClass(actor: PolicyActor, classId: string | undefined, teacherUserId?: string): boolean {
  if (isLegacy(actor)) return actor.userId === teacherUserId || Object.entries(actor.rolesByOrg).some(([orgId]) => hasOrgRole(actor, orgId, 'admin'))
  if (actor.kind !== 'staff') return false
  if (actor.roles.includes('admin')) return true
  return Boolean(classId && actor.roles.includes('teacher') && actor.ownedClassIds.includes(classId)) || actor.userId === teacherUserId
}

export function learnerTokenIsActive(
  actor: PolicyActor,
  nowIso = new Date().toISOString(),
): actor is LearnerTokenPolicyActor {
  return !isLegacy(actor) && actor.kind === 'learner-token' && !actor.revokedAt && actor.expiresAt > nowIso
}

/** Singleton Chunks Workspace: active staff can read workspace shell; Admin manages it. */
export function canReadWorkspace(actor: PolicyActor, _row: WorkspaceScoped = {}): boolean {
  return isLegacy(actor) ? actor.organizationIds.length > 0 : actor.kind === 'staff'
}

/** Back-compat organization read mirror. */
export function canReadOrganization(actor: PolicyActor, row: OrgScoped): boolean {
  return isOrgMember(actor, row.organizationId)
}

export function canReadCourse(actor: PolicyActor, row: OrgScoped): boolean {
  return isOrgMember(actor, row.organizationId)
}

/** Courses/catalog management is Admin-only for this #5 slice. */
export function canManageWorkspaceCatalog(actor: PolicyActor): boolean {
  return isAdmin(actor)
}

export function canManageCourse(actor: PolicyActor, row: OrgScoped): boolean {
  return hasOrgRole(actor, row.organizationId, 'admin')
}

export function canReadClass(actor: PolicyActor, row: { classId?: string; teacherUserId?: string; organizationId?: string }): boolean {
  if (row.organizationId && isLegacy(actor)) return isOrgMember(actor, row.organizationId)
  return isAdmin(actor) || isTeacherForClass(actor, row.classId, row.teacherUserId)
}

export function canManageClass(actor: PolicyActor, row: { classId?: string; teacherUserId: string }): boolean {
  return isAdmin(actor) || isTeacherForClass(actor, row.classId, row.teacherUserId)
}

export function canReadEnrollment(actor: PolicyActor, row: LearnerOwned): boolean {
  if (isLegacy(actor)) {
    if (!row.organizationId || !isOrgMember(actor, row.organizationId)) return false
    return actor.userId === row.learnerUserId || actor.userId === row.teacherUserId || hasOrgRole(actor, row.organizationId, 'admin')
  }
  if (isAdmin(actor) || isTeacherForClass(actor, row.classId, row.teacherUserId)) return true
  return learnerTokenIsActive(actor) && actor.learnerUserId === row.learnerUserId && (!actor.classId || actor.classId === row.classId)
}

/**
 * Assessment/report data: Admin or assigned Teacher may read; a signed learner
 * token can read only its learner + class scope while active.
 */
export function canReadLearnerAssessment(
  actor: PolicyActor,
  row: LearnerOwned,
  nowIso?: string,
): boolean {
  if (isLegacy(actor)) return canReadEnrollment(actor, row)
  if (isAdmin(actor) || isTeacherForClass(actor, row.classId, row.teacherUserId)) return true
  return learnerTokenIsActive(actor, nowIso) && actor.learnerUserId === row.learnerUserId && (!actor.classId || actor.classId === row.classId)
}

export function canCaptureAssessment(actor: PolicyActor, row: ClassScoped): boolean {
  if (isLegacy(actor)) {
    return Boolean(row.organizationId && isOrgMember(actor, row.organizationId) && (actor.userId === row.teacherUserId || hasOrgRole(actor, row.organizationId, 'admin')))
  }
  return isAdmin(actor) || isTeacherForClass(actor, row.classId, row.teacherUserId)
}

export function filterVisible<T>(
  rows: T[],
  actor: PolicyActor,
  canRead: (actor: PolicyActor, row: T) => boolean,
): T[] {
  return rows.filter((row) => canRead(actor, row))
}
