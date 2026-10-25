import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ensureSupabaseStaffWorkspace,
  loadWorkspaceFromSupabase,
  normalizeIdsForDb,
  verifyWorkspacePersistence,
  type WorkspaceSnapshot,
} from './supabase-sync'
import { createSeedRoster } from '../modules/roster/seed'

const mocks = vi.hoisted(() => ({ getSupabase: vi.fn() }))
vi.mock('./supabase', () => ({ getSupabase: mocks.getSupabase }))

function existingTeacherClient(options?: { hasMembership?: boolean; hasUser?: boolean }) {
  const hasMembership = options?.hasMembership ?? true
  const hasUser = options?.hasUser ?? true
  const userInsert = vi.fn()
  const membershipUpsert = vi.fn()
  const roleUpsert = vi.fn()

  const from = vi.fn((table: string) => {
    if (table === 'users') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: hasUser ? { id: 'teacher-domain-1' } : null,
              error: null,
            }),
          }),
        }),
        update: () => ({ eq: async () => ({ error: null }) }),
        insert: userInsert,
      }
    }
    if (table === 'organization_memberships') {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({
              data: hasMembership ? [{ organization_id: 'org-1' }] : [],
              error: null,
            }),
          }),
        }),
        upsert: membershipUpsert,
      }
    }
    if (table === 'staff_roles') return { upsert: roleUpsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { client: { from }, from, userInsert, membershipUpsert, roleUpsert }
}

describe('ensureSupabaseStaffWorkspace', () => {
  beforeEach(() => mocks.getSupabase.mockReset())

  it('resolves a Teacher through existing authoritative membership without role writes', async () => {
    const fake = existingTeacherClient()
    mocks.getSupabase.mockReturnValue(fake.client)

    await expect(
      ensureSupabaseStaffWorkspace({
        authUserId: 'auth-teacher-1',
        email: 'teacher@example.com',
        displayName: 'Teacher',
        roles: ['teacher'],
      }),
    ).resolves.toEqual({ ok: true, organizationId: 'org-1' })

    expect(fake.membershipUpsert).not.toHaveBeenCalled()
    expect(fake.roleUpsert).not.toHaveBeenCalled()
    expect(fake.from).not.toHaveBeenCalledWith('organizations')
  })

  it('fails closed when a Teacher has no pre-provisioned organization membership', async () => {
    const fake = existingTeacherClient({ hasMembership: false })
    mocks.getSupabase.mockReturnValue(fake.client)

    await expect(
      ensureSupabaseStaffWorkspace({
        authUserId: 'auth-teacher-1',
        email: 'teacher@example.com',
        displayName: 'Teacher',
        roles: ['teacher'],
      }),
    ).resolves.toEqual({ ok: false, error: 'Teacher organization membership is missing' })
    expect(fake.membershipUpsert).not.toHaveBeenCalled()
    expect(fake.roleUpsert).not.toHaveBeenCalled()
  })

  it('does not let a Teacher-only session provision a missing domain account', async () => {
    const fake = existingTeacherClient({ hasUser: false })
    mocks.getSupabase.mockReturnValue(fake.client)

    await expect(
      ensureSupabaseStaffWorkspace({
        authUserId: 'auth-teacher-1',
        email: 'teacher@example.com',
        displayName: 'Teacher',
        roles: ['teacher'],
      }),
    ).resolves.toEqual({ ok: false, error: 'Teacher account must be pre-provisioned by Admin' })
    expect(fake.userInsert).not.toHaveBeenCalled()
  })
})

describe('Edit Day cloud persistence verification', () => {
  beforeEach(() => mocks.getSupabase.mockReset())

  function fixture(): WorkspaceSnapshot {
    const roster = createSeedRoster()
    return normalizeIdsForDb({
      roster,
      scheduling: {
        scheduledSessions: [],
        attendance: [],
        learningSessions: [{
          id: '55555555-5555-4555-8555-555555555555',
          classId: roster.classes[0]!.id,
          scheduledSessionId: null,
          status: 'completed',
          plannedQuestionCount: 116,
          startedAt: '2026-07-10T09:00:00.000Z',
          completedAt: '2026-07-10T11:00:00.000Z',
          maxProbeCount: 2,
          sessionNumber: 7,
          ownerUserId: roster.classes[0]!.teacherUserId,
          lockExpiresAt: null,
          sessionKind: 'regular',
          participantLearnerIds: null,
        }],
      },
    })
  }

  function serveSnapshot(expected: WorkspaceSnapshot, cloudDay: number | null, missing = false) {
    const session = expected.scheduling.learningSessions[0]!
    mocks.getSupabase.mockReturnValue({
      from: (table: string) => {
        if (table !== 'organizations') throw new Error(`Unexpected table: ${table}`)
        return {
          select: () => ({
            order: () => ({
              eq: async () => ({ data: [expected.roster.organization], error: null }),
            }),
          }),
        }
      },
      rpc: async (name: string) => {
        if (name !== 'get_workspace_snapshot') throw new Error(`Unexpected RPC: ${name}`)
        return {
          error: null,
          data: {
            ok: true,
            revision: 12,
            data: {
              roster: expected.roster,
              scheduling: {
                scheduledSessions: [],
                attendance: [],
                learningSessions: missing ? [] : [{
                  id: session.id,
                  class_id: session.classId,
                  status: session.status,
                  started_at: session.startedAt,
                  completed_at: session.completedAt,
                  session_number: cloudDay,
                  planned_question_count: session.plannedQuestionCount,
                  max_probe_count: session.maxProbeCount,
                }],
              },
            },
          },
        }
      },
    })
  }

  it('hydrates and verifies the saved cloud day rather than a browser-only label', async () => {
    const expected = fixture()
    serveSnapshot(expected, 7)
    const loaded = await loadWorkspaceFromSupabase({ organizationId: expected.roster.organization.id })
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) throw new Error(loaded.error)
    expect(loaded.data.scheduling.learningSessions[0]).toMatchObject({
      id: expected.scheduling.learningSessions[0]!.id,
      sessionNumber: 7,
      plannedQuestionCount: 116,
    })
    await expect(verifyWorkspacePersistence(expected)).resolves.toEqual({ ok: true })
  })

  it.each([3, null])('rejects cloud day %s even when the session ID exists after reload', async (cloudDay) => {
    const expected = fixture()
    serveSnapshot(expected, cloudDay)
    const verified = await verifyWorkspacePersistence(expected)
    expect(verified.ok).toBe(false)
    if (verified.ok) throw new Error('An unchanged cloud day must not be acknowledged as saved')
    expect(verified.error).toContain(expected.scheduling.learningSessions[0]!.id)
  })

  it('rejects a session missing from the cloud snapshot', async () => {
    const expected = fixture()
    serveSnapshot(expected, 7, true)
    const verified = await verifyWorkspacePersistence(expected)
    expect(verified.ok).toBe(false)
    if (verified.ok) throw new Error('A missing session must not be acknowledged as saved')
    expect(verified.error).toContain(expected.scheduling.learningSessions[0]!.id)
  })
})
