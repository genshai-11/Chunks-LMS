import type { DomainUser, RosterState } from './types'

/** Empty org — app starts with no mock people/classes. */
export function createEmptyRoster(): RosterState {
  return {
    organization: {
      id: 'org-local',
      name: 'My organization',
    },
    users: [],
    courses: [],
    classes: [],
    enrollments: [],
  }
}

/**
 * Deterministic fixtures for unit/e2e tests only — not used by the app UI.
 */
export function createSeedRoster(): RosterState {
  const users: DomainUser[] = [
    {
      id: '22222222-2222-2222-2222-222222222201',
      displayName: 'Demo Admin',
      email: 'admin@example.com',
      avatarUrl: null,
      roles: ['admin'],
    },
    {
      id: '22222222-2222-2222-2222-222222222202',
      displayName: 'Demo Teacher',
      email: 'teacher@example.com',
      avatarUrl: null,
      roles: ['teacher'],
    },
    {
      id: '22222222-2222-2222-2222-222222222203',
      displayName: 'Learner One',
      email: 'l1@example.com',
      avatarUrl: null,
      roles: ['learner'],
    },
    {
      id: '22222222-2222-2222-2222-222222222204',
      displayName: 'Learner Two',
      email: 'l2@example.com',
      avatarUrl: null,
      roles: ['learner'],
    },
    {
      id: '22222222-2222-2222-2222-222222222205',
      displayName: 'Learner Three',
      email: 'l3@example.com',
      avatarUrl: null,
      roles: ['learner'],
    },
  ]

  return {
    organization: {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Chunks Demo Org',
    },
    users,
    courses: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        organizationId: '11111111-1111-1111-1111-111111111111',
        code: 'ERE-Level-B',
        name: 'ERE Level B',
        status: 'active',
        startsOn: '2026-07-01',
        // Auto from Tue+Wed × 15 sessions starting 2026-07-01 (Wed)
        endsOn: '2026-08-19',
        schedule: {
          weekdays: [2, 3], // Tue, Wed
          startTime: '09:00',
          durationMinutes: 60,
          sessionCount: 15,
          timeZone: 'Asia/Ho_Chi_Minh',
        },
      },
    ],
    classes: [
      {
        id: '44444444-4444-4444-4444-444444444444',
        courseId: '33333333-3333-3333-3333-333333333333',
        name: 'Class B-1',
        capacity: 3,
        teacherUserId: '22222222-2222-2222-2222-222222222202',
        status: 'active',
      },
    ],
    enrollments: [
      {
        id: 'enr-1',
        classId: '44444444-4444-4444-4444-444444444444',
        learnerUserId: '22222222-2222-2222-2222-222222222203',
        status: 'active',
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: null,
      },
      {
        id: 'enr-2',
        classId: '44444444-4444-4444-4444-444444444444',
        learnerUserId: '22222222-2222-2222-2222-222222222204',
        status: 'active',
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: null,
      },
      {
        id: 'enr-3',
        classId: '44444444-4444-4444-4444-444444444444',
        learnerUserId: '22222222-2222-2222-2222-222222222205',
        status: 'active',
        startedAt: '2026-07-01T00:00:00.000Z',
        endedAt: null,
      },
    ],
  }
}

/** Domain + Supabase IDs are plain UUIDs (Postgres uuid columns). */
export function newId(_prefix?: string): string {
  return crypto.randomUUID()
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
