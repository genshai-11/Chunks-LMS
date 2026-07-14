/**
 * Supabase backend sync for Chunks-LMS workspace (roster + scheduling).
 * Phase D: upsert-first; prune only when allowEmptyWipe / pruneMissing.
 * Never deletes open or lock-protected learning sessions.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeCourseSchedule } from '../modules/roster/schedule'
import type { CourseSchedule, DomainUser, RosterState } from '../modules/roster/types'
import { createEmptyRoster, isUuid, LOCAL_ORG_ID, newId } from '../modules/roster/seed'
import type { LearningSession, SchedulingState, SessionKind } from '../modules/scheduling/types'

function parseSessionKind(value: string | null | undefined): SessionKind {
  if (value === 'pretest' || value === 'posttest' || value === 'regular') return value
  return 'regular'
}
import { emptySchedulingState } from '../modules/scheduling/session-lifecycle'
import { dedupeById, protectedLearningSessionIds, prunableIds } from '../modules/sync/entity-sync'
import { rolesForWorkspaceUser, userIdsForWorkspace } from '../modules/sync/workspace-graph'
import { getSupabase } from './supabase'

/** Loose client — foundation DB types are partial; cast for sync ops. */
function db(): SupabaseClient | null {
  return getSupabase() as unknown as SupabaseClient | null
}

export type WorkspaceSnapshot = {
  roster: RosterState
  scheduling: SchedulingState
}

export type SyncResult = { ok: true; source: 'supabase' | 'empty' } | { ok: false; error: string }

export type VerifySyncResult = { ok: true } | { ok: false; error: string }

type DeleteFail = { ok: false; error: string }

function failDelete(scope: string, error: { message?: string } | null): DeleteFail | null {
  return error ? { ok: false, error: `${scope}: ${error.message ?? 'unknown error'}` } : null
}

async function deleteAttemptsForLearners(
  sb: SupabaseClient,
  learnerUserIds: string[],
): Promise<DeleteFail | null> {
  if (learnerUserIds.length === 0) return null
  const attemptDelete = await sb.from('assessment_attempts').delete().in('learner_user_id', learnerUserIds)
  return failDelete('assessment attempts', attemptDelete.error)
}

async function deleteAttemptsForLearningSessions(
  sb: SupabaseClient,
  learningSessionIds: string[],
): Promise<DeleteFail | null> {
  if (learningSessionIds.length === 0) return null
  const attemptDelete = await sb
    .from('assessment_attempts')
    .delete()
    .in('learning_session_id', learningSessionIds)
  return failDelete('assessment attempts', attemptDelete.error)
}

async function pruneLearnerSessionRows(
  sb: SupabaseClient,
  learnerUserIds: string[],
): Promise<DeleteFail | null> {
  if (learnerUserIds.length === 0) return null
  const sessions = await sb.from('learning_sessions').select('id, participant_learner_ids')
  if (sessions.error) return { ok: false, error: `learning sessions lookup: ${sessions.error.message}` }

  const deleteIds: string[] = []
  const updates: Array<{ id: string; participant_learner_ids: string[] }> = []
  const learnerSet = new Set(learnerUserIds)
  for (const row of sessions.data ?? []) {
    const participants = Array.isArray(row.participant_learner_ids)
      ? (row.participant_learner_ids as string[])
      : []
    if (!participants.some((id) => learnerSet.has(id))) continue
    const next = participants.filter((id) => !learnerSet.has(id))
    if (next.length === 0) deleteIds.push(row.id as string)
    else updates.push({ id: row.id as string, participant_learner_ids: next })
  }

  if (deleteIds.length > 0) {
    const attemptError = await deleteAttemptsForLearningSessions(sb, deleteIds)
    if (attemptError) return attemptError
    const attendanceDelete = await sb.from('attendance_records').delete().in('learning_session_id', deleteIds)
    const attendanceError = failDelete('attendance', attendanceDelete.error)
    if (attendanceError) return attendanceError
    const sessionDelete = await sb.from('learning_sessions').delete().in('id', deleteIds)
    const sessionError = failDelete('learning sessions', sessionDelete.error)
    if (sessionError) return sessionError
  }

  for (const update of updates) {
    const patched = await sb
      .from('learning_sessions')
      .update({ participant_learner_ids: update.participant_learner_ids })
      .eq('id', update.id)
    const patchError = failDelete('learning session participants', patched.error)
    if (patchError) return patchError
  }

  return null
}

export async function deleteWorkspaceLearningDataFromSupabase(
  organizationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase not configured' }

  const fail = (scope: string, error: { message?: string } | null) =>
    error ? ({ ok: false as const, error: `${scope}: ${error.message ?? 'unknown error'}` }) : null

  const courses = await sb.from('courses').select('id').eq('organization_id', organizationId)
  if (courses.error) return { ok: false, error: `courses: ${courses.error.message}` }
  const courseIds = (courses.data ?? []).map((row) => row.id as string)

  const classes = courseIds.length
    ? await sb.from('classes').select('id').in('course_id', courseIds)
    : { data: [], error: null }
  if (classes.error) return { ok: false, error: `classes: ${classes.error.message}` }
  const classIds = (classes.data ?? []).map((row) => row.id as string)

  const learnerMemberships = await sb
    .from('organization_memberships')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('role', 'learner')
  if (learnerMemberships.error) {
    return { ok: false, error: `learner memberships: ${learnerMemberships.error.message}` }
  }
  const learnerUserIds = (learnerMemberships.data ?? []).map((row) => row.user_id as string)

  if (classIds.length > 0) {
    const learning = await sb.from('learning_sessions').select('id').in('class_id', classIds)
    if (learning.error) return { ok: false, error: `learning sessions: ${learning.error.message}` }
    const learningIds = (learning.data ?? []).map((row) => row.id as string)

    if (learningIds.length > 0) {
      const attemptError = await deleteAttemptsForLearningSessions(sb, learningIds)
      if (attemptError) return attemptError

      const attendance = await sb.from('attendance_records').delete().in('learning_session_id', learningIds)
      const attendanceError = fail('attendance', attendance.error)
      if (attendanceError) return attendanceError

      // Deleting learning_sessions cascades remaining session questions, attempts, snapshots, and events.
      const learningDelete = await sb.from('learning_sessions').delete().in('id', learningIds)
      const learningDeleteError = fail('learning sessions', learningDelete.error)
      if (learningDeleteError) return learningDeleteError
    }

    const scheduled = await sb.from('scheduled_sessions').delete().in('class_id', classIds)
    const scheduledError = fail('scheduled sessions', scheduled.error)
    if (scheduledError) return scheduledError

    const enrollments = await sb.from('enrollments').delete().in('class_id', classIds)
    const enrollmentError = fail('enrollments', enrollments.error)
    if (enrollmentError) return enrollmentError

    const classDelete = await sb.from('classes').delete().in('id', classIds)
    const classDeleteError = fail('classes', classDelete.error)
    if (classDeleteError) return classDeleteError
  }

  if (courseIds.length > 0) {
    const courseDelete = await sb.from('courses').delete().in('id', courseIds)
    const courseDeleteError = fail('courses', courseDelete.error)
    if (courseDeleteError) return courseDeleteError
  }

  if (learnerUserIds.length > 0) {
    const membershipDelete = await sb
      .from('organization_memberships')
      .delete()
      .eq('organization_id', organizationId)
      .eq('role', 'learner')
    const membershipDeleteError = fail('learner memberships', membershipDelete.error)
    if (membershipDeleteError) return membershipDeleteError

    const userDelete = await sb.from('users').delete().in('id', learnerUserIds)
    const userDeleteError = fail('learner users', userDelete.error)
    if (userDeleteError) return userDeleteError
  }

  return { ok: true }
}

export type ClerkWorkspaceIdentity = {
  clerkUserId: string
  email: string | null
  displayName: string
  roles: Array<'admin' | 'teacher'>
}

export async function ensureClerkWorkspace(
  identity: ClerkWorkspaceIdentity,
): Promise<{ ok: true; organizationId: string } | { ok: false; error: string }> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase not configured' }

  const existingUser = await sb
    .from('users')
    .select('id')
    .eq('clerk_user_id', identity.clerkUserId)
    .maybeSingle()
  if (existingUser.error) return { ok: false, error: existingUser.error.message }

  let userId = existingUser.data?.id as string | undefined
  if (!userId) {
    const inserted = await sb
      .from('users')
      .insert({
        clerk_user_id: identity.clerkUserId,
        display_name: identity.displayName,
        email: identity.email,
      })
      .select('id')
      .single()
    if (inserted.error) return { ok: false, error: inserted.error.message }
    userId = inserted.data.id as string
  } else {
    const updated = await sb
      .from('users')
      .update({ display_name: identity.displayName, email: identity.email })
      .eq('id', userId)
    if (updated.error) return { ok: false, error: updated.error.message }
  }

  const memberships = await sb
    .from('organization_memberships')
    .select('organization_id')
    .eq('user_id', userId)
  if (memberships.error) return { ok: false, error: memberships.error.message }

  let organizationId = memberships.data?.[0]?.organization_id as string | undefined
  if (!organizationId) {
    const clerkOrgId = `personal:${identity.clerkUserId}`
    const existingOrg = await sb
      .from('organizations')
      .select('id')
      .eq('clerk_org_id', clerkOrgId)
      .maybeSingle()
    if (existingOrg.error) return { ok: false, error: existingOrg.error.message }
    organizationId = existingOrg.data?.id as string | undefined
    if (!organizationId) {
      const insertedOrg = await sb
        .from('organizations')
        .insert({ name: `${identity.displayName} Workspace`, clerk_org_id: clerkOrgId })
        .select('id')
        .single()
      if (insertedOrg.error) return { ok: false, error: insertedOrg.error.message }
      organizationId = insertedOrg.data.id as string
    }
  }

  const roles = identity.roles.length > 0 ? identity.roles : ['teacher' as const]
  const membershipRows = roles.map((role) => ({
    organization_id: organizationId!,
    user_id: userId!,
    role,
  }))
  const membershipUpsert = await sb
    .from('organization_memberships')
    .upsert(membershipRows, { onConflict: 'organization_id,user_id,role' })
  if (membershipUpsert.error) return { ok: false, error: membershipUpsert.error.message }

  return { ok: true, organizationId }
}

function asSchedule(raw: unknown): CourseSchedule | null {
  if (!raw || typeof raw !== 'object') return null
  return normalizeCourseSchedule(raw as Partial<CourseSchedule>)
}

/** Ensure all domain IDs are UUIDs so Postgres accepts them. */
export function normalizeIdsForDb(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const idMap = new Map<string, string>()
  const mapId = (id: string) => {
    if (isUuid(id)) return id
    // Legacy non-uuid org keys always map to the stable local org id
    if (id === 'org-local' || id === 'org-local-empty' || id.startsWith('org-')) {
      return LOCAL_ORG_ID
    }
    if (!idMap.has(id)) idMap.set(id, newId())
    return idMap.get(id)!
  }

  const roster: RosterState = {
    organization: {
      ...snapshot.roster.organization,
      id: mapId(snapshot.roster.organization.id),
    },
    users: snapshot.roster.users.map((u) => ({
      ...u,
      id: mapId(u.id),
    })),
    courses: snapshot.roster.courses.map((c) => ({
      ...c,
      id: mapId(c.id),
      organizationId: mapId(c.organizationId),
    })),
    classes: snapshot.roster.classes.map((c) => ({
      ...c,
      id: mapId(c.id),
      courseId: mapId(c.courseId),
      teacherUserId: mapId(c.teacherUserId),
    })),
    enrollments: snapshot.roster.enrollments.map((e) => ({
      ...e,
      id: mapId(e.id),
      classId: mapId(e.classId),
      learnerUserId: mapId(e.learnerUserId),
    })),
  }

  const scheduling: SchedulingState = {
    scheduledSessions: snapshot.scheduling.scheduledSessions.map((s) => ({
      ...s,
      id: mapId(s.id),
      classId: mapId(s.classId),
      rescheduledFromId: s.rescheduledFromId ? mapId(s.rescheduledFromId) : null,
      sessionNumber: s.sessionNumber ?? null,
    })),
    learningSessions: snapshot.scheduling.learningSessions.map((s) => ({
      ...s,
      id: mapId(s.id),
      classId: mapId(s.classId),
      scheduledSessionId: s.scheduledSessionId ? mapId(s.scheduledSessionId) : null,
      sessionNumber: s.sessionNumber ?? null,
      ownerUserId: s.ownerUserId ? mapId(s.ownerUserId) : null,
      lockExpiresAt: s.lockExpiresAt ?? null,
    })),
    attendance: snapshot.scheduling.attendance.map((a) => ({
      ...a,
      id: mapId(a.id),
      learningSessionId: mapId(a.learningSessionId),
      learnerUserId: mapId(a.learnerUserId),
    })),
  }

  return { roster, scheduling }
}

export async function loadWorkspaceFromSupabase(options?: {
  organizationId?: string
}): Promise<{ ok: true; data: WorkspaceSnapshot } | { ok: false; error: string }> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase not configured' }

  try {
    // Authenticated staff must load only their provisioned organization.
    let orgQuery = sb.from('organizations').select('*').order('created_at', { ascending: true })
    if (options?.organizationId) orgQuery = orgQuery.eq('id', options.organizationId)
    const { data: orgs, error: orgErr } = await orgQuery

    if (orgErr) return { ok: false, error: orgErr.message }
    if (!orgs?.length) {
      return {
        ok: true,
        data: { roster: createEmptyRoster(), scheduling: emptySchedulingState() },
      }
    }

    let org =
      orgs.find((o) => o.id === options?.organizationId) ??
      orgs.find((o) => o.id === LOCAL_ORG_ID) ??
      orgs[0]!
    // Legacy anonymous mode only: prefer the richest workspace.
    if (!options?.organizationId && orgs.length > 1) {
      const counts = await Promise.all(
        orgs.map(async (o) => {
          const { count } = await sb
            .from('courses')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', o.id as string)
          return { org: o, count: count ?? 0 }
        }),
      )
      counts.sort((a, b) => b.count - a.count)
      const best = counts[0]
      if (best && best.count > 0) org = best.org
      else if (orgs.find((o) => o.id === LOCAL_ORG_ID)) {
        org = orgs.find((o) => o.id === LOCAL_ORG_ID)!
      }
    }
    const orgId = org.id as string

    const [
      membersRes,
      usersRes,
      coursesRes,
      classesRes,
      enrollmentsRes,
      scheduledRes,
      learningRes,
      attendanceRes,
    ] = await Promise.all([
      sb.from('organization_memberships').select('*').eq('organization_id', orgId),
      sb.from('users').select('*'),
      sb.from('courses').select('*').eq('organization_id', orgId),
      sb.from('classes').select('*'),
      sb.from('enrollments').select('*'),
      sb.from('scheduled_sessions').select('*'),
      sb.from('learning_sessions').select('*'),
      sb.from('attendance_records').select('*'),
    ])

    for (const r of [
      membersRes,
      usersRes,
      coursesRes,
      classesRes,
      enrollmentsRes,
      scheduledRes,
      learningRes,
      attendanceRes,
    ]) {
      if (r.error) return { ok: false, error: r.error.message }
    }

    const memberUserIds = new Set((membersRes.data ?? []).map((m) => m.user_id as string))
    const rolesByUser = new Map<string, DomainUser['roles']>()
    for (const m of membersRes.data ?? []) {
      const uid = m.user_id as string
      const role = m.role as DomainUser['roles'][number]
      const prev = rolesByUser.get(uid) ?? []
      if (!prev.includes(role)) rolesByUser.set(uid, [...prev, role])
    }

    const courseIds = new Set((coursesRes.data ?? []).map((c) => c.id as string))
    const courses = (coursesRes.data ?? []).map((c) => ({
      id: c.id as string,
      organizationId: c.organization_id as string,
      code: c.code as string,
      name: c.name as string,
      status: c.status as 'active' | 'archived',
    }))

    const classes = (classesRes.data ?? [])
      .filter((cl) => courseIds.has(cl.course_id as string))
      .map((cl) => ({
        id: cl.id as string,
        courseId: cl.course_id as string,
        name: cl.name as string,
        capacity: cl.capacity as number,
        teacherUserId: cl.teacher_user_id as string,
        status: cl.status as 'active' | 'ended',
        startsOn: (cl.starts_on as string | null) ?? null,
        endsOn: (cl.ends_on as string | null) ?? null,
        schedule: asSchedule((cl as { schedule?: unknown }).schedule),
      }))

    const classIds = new Set(classes.map((c) => c.id))
    const enrollments = (enrollmentsRes.data ?? [])
      .filter((e) => classIds.has(e.class_id as string))
      .map((e) => ({
        id: e.id as string,
        classId: e.class_id as string,
        learnerUserId: e.learner_user_id as string,
        status: e.status as 'active' | 'ended',
        startedAt: e.started_at as string,
        endedAt: (e.ended_at as string | null) ?? null,
      }))

    const teacherUserIds = new Set(classes.map((cl) => cl.teacherUserId))
    const learnerUserIds = new Set(enrollments.map((e) => e.learnerUserId))
    const workspaceUserIds = userIdsForWorkspace({ classes, enrollments }, memberUserIds)

    const users: DomainUser[] = (usersRes.data ?? [])
      .filter((u) => workspaceUserIds.has(u.id as string))
      .map((u) => {
        const userId = u.id as string
        return {
          id: userId,
          displayName: u.display_name as string,
          email: (u.email as string | null) ?? null,
          avatarUrl: ((u as { avatar_url?: string | null }).avatar_url ?? null) as string | null,
          roles: rolesForWorkspaceUser({
            userId,
            membershipRoles: rolesByUser.get(userId) ?? [],
            teacherUserIds,
            learnerUserIds,
          }),
          accountStatus:
            (u as { account_status?: string | null }).account_status === 'inactive'
              ? ('inactive' as const)
              : ('active' as const),
        }
      })

    const scheduledSessions = (scheduledRes.data ?? [])
      .filter((s) => classIds.has(s.class_id as string))
      .map((s) => ({
        id: s.id as string,
        classId: s.class_id as string,
        plannedStart: s.planned_start as string,
        durationMinutes: s.duration_minutes as number,
        status: s.status as 'scheduled' | 'completed' | 'cancelled' | 'rescheduled',
        rescheduledFromId: (s.rescheduled_from_id as string | null) ?? null,
        sessionNumber:
          typeof (s as { session_number?: number | null }).session_number === 'number'
            ? ((s as { session_number?: number }).session_number as number)
            : null,
      }))

    const learningSessions: LearningSession[] = (learningRes.data ?? [])
      .filter((s) => classIds.has(s.class_id as string))
      .map((s) => {
        const row = s as {
          session_number?: number | null
          owner_user_id?: string | null
          lock_expires_at?: string | null
          session_kind?: string | null
          participant_learner_ids?: string[] | null
        }
        return {
          id: s.id as string,
          classId: s.class_id as string,
          scheduledSessionId: (s.scheduled_session_id as string | null) ?? null,
          status: s.status as 'open' | 'completed',
          plannedQuestionCount: (s.planned_question_count as number | null) ?? null,
          startedAt: s.started_at as string,
          completedAt: (s.completed_at as string | null) ?? null,
          maxProbeCount: (s.max_probe_count as number) ?? 2,
          sessionNumber: typeof row.session_number === 'number' ? row.session_number : null,
          ownerUserId: (row.owner_user_id as string | null) ?? null,
          lockExpiresAt: (row.lock_expires_at as string | null) ?? null,
          sessionKind: parseSessionKind(row.session_kind),
          participantLearnerIds: Array.isArray(row.participant_learner_ids)
            ? row.participant_learner_ids
            : null,
        }
      })

    const lsIds = new Set(learningSessions.map((s) => s.id))
    const attendance = (attendanceRes.data ?? [])
      .filter((a) => lsIds.has(a.learning_session_id as string))
      .map((a) => ({
        id: a.id as string,
        learningSessionId: a.learning_session_id as string,
        learnerUserId: a.learner_user_id as string,
        status: a.status as 'present' | 'late' | 'absent' | 'excused',
        recordedAt: a.recorded_at as string,
      }))

    return {
      ok: true,
      data: {
        roster: {
          organization: { id: orgId, name: org.name as string },
          users,
          courses,
          classes,
          enrollments,
        },
        scheduling: {
          scheduledSessions,
          learningSessions,
          attendance,
        },
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Load failed' }
  }
}

export type SaveWorkspaceOptions = {
  /**
   * When true, empty local roster may delete cloud rows for this org.
   * Default false — refuses to wipe non-empty cloud with empty UI (boot race).
   */
  allowEmptyWipe?: boolean
  /**
   * When true, delete cloud rows missing from local (dangerous for multi-user).
   * Default false — upsert only. allowEmptyWipe implies prune.
   */
  pruneMissing?: boolean
}

function workspaceIsEmpty(s: WorkspaceSnapshot): boolean {
  return (
    s.roster.users.length === 0 &&
    s.roster.courses.length === 0 &&
    s.roster.classes.length === 0 &&
    s.roster.enrollments.length === 0 &&
    s.scheduling.scheduledSessions.length === 0 &&
    s.scheduling.learningSessions.length === 0
  )
}

export async function saveWorkspaceToSupabase(
  raw: WorkspaceSnapshot,
  options: SaveWorkspaceOptions = {},
): Promise<SyncResult> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase not configured' }

  const { roster, scheduling } = normalizeIdsForDb(raw)
  const orgId = roster.organization.id
  const prune = Boolean(options.allowEmptyWipe || options.pruneMissing)

  try {
    // Guard: never let an empty boot/race wipe existing cloud data
    if (workspaceIsEmpty({ roster, scheduling }) && !options.allowEmptyWipe) {
      const { count: courseCount } = await sb
        .from('courses')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
      const { count: userMemCount } = await sb
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
      if ((courseCount ?? 0) > 0 || (userMemCount ?? 0) > 0) {
        return {
          ok: false,
          error: 'Refused empty save — cloud has data. Use Clear data to wipe intentionally.',
        }
      }
    }

    // 1) Org
    {
      const { error } = await sb.from('organizations').upsert(
        {
          id: orgId,
          name: roster.organization.name,
        },
        { onConflict: 'id' },
      )
      if (error) return { ok: false, error: `org: ${error.message}` }
    }

    // 2) Users — upsert only (never delete users; other browser may still reference)
    if (roster.users.length > 0) {
      const ids = roster.users.map((u) => u.id)
      // Preserve real Clerk ids so re-login does not create duplicate staff rows.
      const { data: existingUsers } = await sb
        .from('users')
        .select('id, clerk_user_id')
        .in('id', ids)
      const clerkById = new Map(
        (existingUsers ?? []).map((row) => [row.id as string, row.clerk_user_id as string]),
      )

      const compactAvatar = (url: string | null) => {
        if (!url) return null
        // Uploaded avatars are compressed client-side. Keep a hard cap so an accidental
        // raw base64 photo cannot break workspace sync payloads.
        if (url.startsWith('data:') && url.length > 100_000) return null
        return url
      }

      const baseRows = roster.users.map((u) => {
        const existingClerk = clerkById.get(u.id)
        const clerkUserId =
          existingClerk && !existingClerk.startsWith('local_')
            ? existingClerk
            : existingClerk || `local_${u.id}`
        return {
          id: u.id,
          clerk_user_id: clerkUserId,
          display_name: u.displayName,
          email: u.email,
          avatar_url: compactAvatar(u.avatarUrl),
          updated_at: new Date().toISOString(),
        }
      })

      const withStatus = baseRows.map((row, i) => ({
        ...row,
        account_status: roster.users[i]!.accountStatus ?? 'active',
      }))

      let { error } = await sb.from('users').upsert(withStatus, { onConflict: 'id' })
      if (error) {
        // Migration not applied yet, or avatar rejected — retry without optional fields
        const { error: e2 } = await sb.from('users').upsert(baseRows, { onConflict: 'id' })
        if (e2) return { ok: false, error: `users: ${e2.message}` }
      }
    }

    // 3) Memberships — upsert current roles; drop memberships for users removed locally
    //    so Admin "delete account" actually disappears after reload (V1 single-org).
    {
      const rows = roster.users.flatMap((u) =>
        u.roles.map((role) => ({
          organization_id: orgId,
          user_id: u.id,
          role,
        })),
      )
      if (options.allowEmptyWipe) {
        await sb.from('organization_memberships').delete().eq('organization_id', orgId)
      }
      if (rows.length > 0) {
        const { error } = await sb
          .from('organization_memberships')
          .upsert(rows, { onConflict: 'organization_id,user_id,role' })
        if (error) return { ok: false, error: `memberships: ${error.message}` }
      }

      // Reconcile: remove org memberships for users no longer in local roster
      const keepIds = new Set(roster.users.map((u) => u.id))
      const { data: existingMembers } = await sb
        .from('organization_memberships')
        .select('id, user_id, role')
        .eq('organization_id', orgId)
      
      const orphanMembers = existingMembers ?? []
      const orphanMemberIds = orphanMembers
        .filter((m) => !keepIds.has(m.user_id as string))
        .map((m) => m.id as string)
      if (orphanMemberIds.length > 0) {
        await sb.from('organization_memberships').delete().in('id', orphanMemberIds)
      }

      // Delete learners and their associated data (enrollments, attendance, attempts) when prune is true
      if (prune) {
        const toDeleteUserIds = orphanMembers
          .filter((m) => m.role === 'learner' && !keepIds.has(m.user_id as string))
          .map((m) => m.user_id as string)

        if (toDeleteUserIds.length > 0) {
          // Check if any of these users still have memberships in other organizations
          const { data: otherMemberships } = await sb
            .from('organization_memberships')
            .select('user_id')
            .in('user_id', toDeleteUserIds)
            .neq('organization_id', orgId)
          const otherMemberUserIds = new Set((otherMemberships ?? []).map((m) => m.user_id as string))
          const pureDeleteUserIds = toDeleteUserIds.filter((id) => !otherMemberUserIds.has(id))

          if (pureDeleteUserIds.length > 0) {
            const sessionError = await pruneLearnerSessionRows(sb, pureDeleteUserIds)
            if (sessionError) return sessionError

            const enrollmentDelete = await sb.from('enrollments').delete().in('learner_user_id', pureDeleteUserIds)
            const enrollmentError = failDelete('enrollments', enrollmentDelete.error)
            if (enrollmentError) return enrollmentError

            const attendanceDelete = await sb.from('attendance_records').delete().in('learner_user_id', pureDeleteUserIds)
            const attendanceError = failDelete('attendance', attendanceDelete.error)
            if (attendanceError) return attendanceError

            const attemptError = await deleteAttemptsForLearners(sb, pureDeleteUserIds)
            if (attemptError) return attemptError

            const userDelete = await sb.from('users').delete().in('id', pureDeleteUserIds)
            const userError = failDelete('users', userDelete.error)
            if (userError) return userError
          }
        }
      }
    }

    // 4) Courses — upsert; optional prune
    {
      if (prune) {
        const { data: existingCourses } = await sb
          .from('courses')
          .select('id')
          .eq('organization_id', orgId)
        const toDelete = prunableIds(
          roster.courses.map((c) => c.id),
          (existingCourses ?? []).map((c) => c.id as string),
          new Set(),
        )
        if (toDelete.length > 0) await sb.from('courses').delete().in('id', toDelete)
      }

      if (roster.courses.length > 0) {
        const { error } = await sb.from('courses').upsert(
          roster.courses.map((c) => ({
            id: c.id,
            organization_id: orgId,
            code: c.code,
            name: c.name,
            status: c.status,
          })),
          { onConflict: 'id' },
        )
        if (error) return { ok: false, error: `courses: ${error.message}` }
      }
    }

    // 5) Classes — upsert; optional prune
    {
      const courseIds = roster.courses.map((c) => c.id)
      if (prune && courseIds.length > 0) {
        const { data: existing } = await sb
          .from('classes')
          .select('id, course_id')
          .in('course_id', courseIds)
        const toDelete = prunableIds(
          roster.classes.map((c) => c.id),
          (existing ?? []).map((c) => c.id as string),
          new Set(),
        )
        if (toDelete.length > 0) await sb.from('classes').delete().in('id', toDelete)
      }

      if (roster.classes.length > 0) {
        const { error } = await sb.from('classes').upsert(
          roster.classes.map((c) => ({
            id: c.id,
            course_id: c.courseId,
            name: c.name,
            capacity: c.capacity,
            teacher_user_id: c.teacherUserId,
            status: c.status,
            starts_on: c.startsOn,
            ends_on: c.endsOn,
            schedule: c.schedule,
          })),
          { onConflict: 'id' },
        )
        if (error) return { ok: false, error: `classes: ${error.message}` }
      }
    }

    // 6) Enrollments — upsert; optional prune
    {
      const classIds = roster.classes.map((c) => c.id)
      if (prune && classIds.length > 0) {
        const { data: existing } = await sb
          .from('enrollments')
          .select('id')
          .in('class_id', classIds)
        const toDelete = prunableIds(
          roster.enrollments.map((e) => e.id),
          (existing ?? []).map((e) => e.id as string),
          new Set(),
        )
        if (toDelete.length > 0) await sb.from('enrollments').delete().in('id', toDelete)
      }

      if (roster.enrollments.length > 0) {
        const { error } = await sb.from('enrollments').upsert(
          roster.enrollments.map((e) => ({
            id: e.id,
            class_id: e.classId,
            learner_user_id: e.learnerUserId,
            status: e.status,
            started_at: e.startedAt,
            ended_at: e.endedAt,
          })),
          { onConflict: 'id' },
        )
        if (error) return { ok: false, error: `enrollments: ${error.message}` }
      }
    }

    // 7) Scheduled sessions — upsert; optional prune
    {
      const classIds = roster.classes.map((c) => c.id)
      const classIdSet = new Set(classIds)
      const scheduledRows = dedupeById(scheduling.scheduledSessions).filter((s) =>
        classIdSet.has(s.classId),
      )
      const scheduledIds = new Set(scheduledRows.map((s) => s.id))

      if (prune && classIds.length > 0) {
        const { data: existing } = await sb
          .from('scheduled_sessions')
          .select('id')
          .in('class_id', classIds)
        const toDelete = prunableIds(
          scheduledRows.map((s) => s.id),
          (existing ?? []).map((s) => s.id as string),
          new Set(),
        )
        if (toDelete.length > 0) await sb.from('scheduled_sessions').delete().in('id', toDelete)
      }

      if (scheduledRows.length > 0) {
        // Keep POST minimal to avoid PostgREST 409s from optional columns/FKs. Optional fields are
        // updated after rows exist. This also drops orphan schedules whose class no longer exists.
        const baseRows = scheduledRows.map((s) => ({
          id: s.id,
          class_id: s.classId,
          planned_start: s.plannedStart,
          duration_minutes: s.durationMinutes,
          status: s.status,
        }))
        const { error } = await sb.from('scheduled_sessions').upsert(baseRows, { onConflict: 'id' })
        if (error) return { ok: false, error: `scheduled: ${error.message}` }

        for (const row of scheduledRows) {
          const patch: { session_number?: number | null; rescheduled_from_id?: string | null } = {
            session_number: row.sessionNumber,
            rescheduled_from_id:
              row.rescheduledFromId && scheduledIds.has(row.rescheduledFromId)
                ? row.rescheduledFromId
                : null,
          }
          const { error: patchError } = await sb
            .from('scheduled_sessions')
            .update(patch)
            .eq('id', row.id)
          if (patchError) {
            const { error: fallbackError } = await sb
              .from('scheduled_sessions')
              .update({ rescheduled_from_id: patch.rescheduled_from_id })
              .eq('id', row.id)
            if (fallbackError) return { ok: false, error: `scheduled refs: ${fallbackError.message}` }
          }
        }
      }
    }

    // 8) Learning sessions — upsert; NEVER delete open/protected; prune only completed orphans when allowed
    {
      const classIds = roster.classes.map((c) => c.id)
      let remoteOpenIds: string[] = []
      if (classIds.length > 0) {
        const { data: existing } = await sb
          .from('learning_sessions')
          .select('id, status')
          .in('class_id', classIds)
        remoteOpenIds = (existing ?? [])
          .filter((s) => s.status === 'open')
          .map((s) => s.id as string)
        if (prune) {
          const protectedIds = protectedLearningSessionIds(scheduling, remoteOpenIds)
          const toDelete = prunableIds(
            scheduling.learningSessions.map((s) => s.id),
            (existing ?? []).map((s) => s.id as string),
            protectedIds,
          )
          if (toDelete.length > 0) {
            await sb.from('learning_sessions').delete().in('id', toDelete)
          }
        }
      }

      const learningRows = dedupeById(scheduling.learningSessions)
      if (learningRows.length > 0) {
        const baseRows = learningRows.map((s) => ({
          id: s.id,
          class_id: s.classId,
          scheduled_session_id: s.scheduledSessionId,
          status: s.status,
          planned_question_count: s.plannedQuestionCount,
          started_at: s.startedAt,
          completed_at: s.completedAt,
          max_probe_count: s.maxProbeCount,
          session_number: s.sessionNumber,
          owner_user_id: s.ownerUserId,
          lock_expires_at: s.lockExpiresAt,
          session_kind: s.sessionKind ?? 'regular',
          participant_learner_ids: s.participantLearnerIds,
        }))
        const { error } = await sb.from('learning_sessions').upsert(baseRows, { onConflict: 'id' })
        if (error) {
          // Retry without optional columns if migration not applied
          const { error: e2 } = await sb.from('learning_sessions').upsert(
            learningRows.map((s) => ({
              id: s.id,
              class_id: s.classId,
              scheduled_session_id: s.scheduledSessionId,
              status: s.status,
              planned_question_count: s.plannedQuestionCount,
              started_at: s.startedAt,
              completed_at: s.completedAt,
              max_probe_count: s.maxProbeCount,
            })),
            { onConflict: 'id' },
          )
          if (e2) return { ok: false, error: `learning: ${e2.message}` }
        }
      }
    }

    // 9) Attendance — upsert; optional prune only non-protected sessions
    {
      const lsIds = scheduling.learningSessions.map((s) => s.id)
      if (prune && lsIds.length > 0) {
        const { data: existing } = await sb
          .from('attendance_records')
          .select('id')
          .in('learning_session_id', lsIds)
        const toDelete = prunableIds(
          scheduling.attendance.map((a) => a.id),
          (existing ?? []).map((a) => a.id as string),
          new Set(),
        )
        if (toDelete.length > 0) await sb.from('attendance_records').delete().in('id', toDelete)
      }

      const attendanceRows = dedupeById(scheduling.attendance)
      if (attendanceRows.length > 0) {
        const { error } = await sb.from('attendance_records').upsert(
          attendanceRows.map((a) => ({
            id: a.id,
            learning_session_id: a.learningSessionId,
            learner_user_id: a.learnerUserId,
            status: a.status,
            recorded_at: a.recordedAt,
          })),
          { onConflict: 'id' },
        )
        if (error) return { ok: false, error: `attendance: ${error.message}` }
      }
    }

    return { ok: true, source: 'supabase' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed' }
  }
}

export async function verifyWorkspacePersistence(
  snapshot: WorkspaceSnapshot,
): Promise<VerifySyncResult> {
  const expected = normalizeIdsForDb(snapshot)
  const loaded = await loadWorkspaceFromSupabase({
    organizationId: expected.roster.organization.id,
  })
  if (!loaded.ok) return { ok: false, error: `reload failed: ${loaded.error}` }

  const missing = [
    ...missingIds(
      'users',
      expected.roster.users.map((u) => u.id),
      loaded.data.roster.users.map((u) => u.id),
    ),
    ...missingIds(
      'courses',
      expected.roster.courses.map((c) => c.id),
      loaded.data.roster.courses.map((c) => c.id),
    ),
    ...missingIds(
      'classes',
      expected.roster.classes.map((c) => c.id),
      loaded.data.roster.classes.map((c) => c.id),
    ),
    ...missingIds(
      'enrollments',
      expected.roster.enrollments.map((e) => e.id),
      loaded.data.roster.enrollments.map((e) => e.id),
    ),
    ...missingIds(
      'scheduled',
      expected.scheduling.scheduledSessions.map((s) => s.id),
      loaded.data.scheduling.scheduledSessions.map((s) => s.id),
    ),
    ...missingIds(
      'learning',
      expected.scheduling.learningSessions.map((s) => s.id),
      loaded.data.scheduling.learningSessions.map((s) => s.id),
    ),
    ...missingIds(
      'attendance',
      expected.scheduling.attendance.map((a) => a.id),
      loaded.data.scheduling.attendance.map((a) => a.id),
    ),
  ]

  if (missing.length > 0) {
    return { ok: false, error: `missing after reload: ${missing.slice(0, 8).join(', ')}` }
  }
  return { ok: true }
}

function missingIds(label: string, expected: string[], actual: string[]): string[] {
  const actualSet = new Set(actual)
  return expected.filter((id) => !actualSet.has(id)).map((id) => `${label}:${id}`)
}

export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null
}
