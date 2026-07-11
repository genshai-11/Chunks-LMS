import { describe, expect, it } from 'vitest'
import {
  canAccessStaffRole,
  normalizeMetadataRoles,
  parseEmailList,
  resolveStaffRoles,
  rolesFromMetadata,
} from './staff-roles'

describe('parseEmailList', () => {
  it('splits and lowercases emails', () => {
    expect(parseEmailList('A@x.com, b@Y.com; c@z.com')).toEqual([
      'a@x.com',
      'b@y.com',
      'c@z.com',
    ])
  })

  it('returns empty for blank', () => {
    expect(parseEmailList('')).toEqual([])
    expect(parseEmailList(null)).toEqual([])
  })
})

describe('rolesFromMetadata', () => {
  it('reads chunksRoles array and chunksRole string', () => {
    expect(rolesFromMetadata({ chunksRoles: ['Admin', 'teacher'] })).toEqual([
      'admin',
      'teacher',
    ])
    expect(rolesFromMetadata({ chunksRole: 'staff' })).toEqual(['staff'])
  })
})

describe('resolveStaffRoles', () => {
  const emptyLists = { adminEmails: [] as string[], teacherEmails: [] as string[] }

  it('grants both roles when auth bypass is on', () => {
    expect(
      resolveStaffRoles(
        { userId: null, email: null },
        { authBypass: true, ...emptyLists },
      ),
    ).toEqual(['admin', 'teacher'])
  })

  it('denies when not signed in and bypass off', () => {
    expect(
      resolveStaffRoles(
        { userId: null, email: 'a@x.com' },
        { authBypass: false, ...emptyLists },
      ),
    ).toEqual([])
  })

  it('uses metadata when present (admin also gets teacher surface)', () => {
    expect(
      resolveStaffRoles(
        {
          userId: 'u1',
          email: 'a@x.com',
          metadataRoles: ['admin'],
        },
        {
          authBypass: false,
          adminEmails: ['other@x.com'],
          teacherEmails: ['t@x.com'],
        },
      ),
    ).toEqual(['admin', 'teacher'])
  })

  it('uses email allowlists when metadata empty', () => {
    expect(
      resolveStaffRoles(
        { userId: 'u1', email: 't@School.edu', metadataRoles: [] },
        {
          authBypass: false,
          adminEmails: ['admin@school.edu'],
          teacherEmails: ['t@school.edu'],
        },
      ),
    ).toEqual(['teacher'])

    expect(
      resolveStaffRoles(
        { userId: 'u1', email: 'admin@school.edu', metadataRoles: [] },
        {
          authBypass: false,
          adminEmails: ['admin@school.edu'],
          teacherEmails: [],
        },
      ),
    ).toEqual(['admin', 'teacher'])
  })

  it('bootstraps any signed-in user when allowlists empty and no metadata', () => {
    expect(
      resolveStaffRoles(
        { userId: 'u1', email: 'anyone@x.com', metadataRoles: [] },
        { authBypass: false, ...emptyLists },
      ),
    ).toEqual(['admin', 'teacher'])
  })

  it('denies signed-in user not on allowlist when lists are set', () => {
    expect(
      resolveStaffRoles(
        { userId: 'u1', email: 'stranger@x.com', metadataRoles: [] },
        {
          authBypass: false,
          adminEmails: ['admin@x.com'],
          teacherEmails: ['t@x.com'],
        },
      ),
    ).toEqual([])
  })
})

describe('canAccessStaffRole', () => {
  it('lets admin open teacher workspace', () => {
    expect(canAccessStaffRole(['admin'], 'teacher')).toBe(true)
    expect(canAccessStaffRole(['admin'], 'admin')).toBe(true)
    expect(canAccessStaffRole(['teacher'], 'admin')).toBe(false)
    expect(canAccessStaffRole(['teacher'], 'teacher')).toBe(true)
  })
})

describe('normalizeMetadataRoles', () => {
  it('handles string and array', () => {
    expect(normalizeMetadataRoles('Admin')).toEqual(['admin'])
    expect(normalizeMetadataRoles(['Teacher'])).toEqual(['teacher'])
  })
})
