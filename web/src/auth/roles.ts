import type { StaffRole } from './staff-roles'

export type StaffRoute = {
  role: StaffRole
  path: string
  label: string
}

/** Staff workspaces only — learner portal is /access, not a staff role. */
export const STAFF_ROUTES: StaffRoute[] = [
  { role: 'admin', path: '/admin', label: 'Admin' },
  { role: 'teacher', path: '/teacher', label: 'Teacher' },
]

export const LEARNER_PORTAL_PATH = '/access'

/** @deprecated use STAFF_ROUTES — kept for any external imports */
export const ROLE_ROUTES = [
  ...STAFF_ROUTES,
  { role: 'learner' as const, path: '/learner', label: 'Learner' },
]

export function canAccessRole(
  userRoles: Array<'admin' | 'teacher' | 'learner'>,
  required: 'admin' | 'teacher' | 'learner',
): boolean {
  if (required === 'teacher') {
    return userRoles.includes('teacher') || userRoles.includes('admin')
  }
  return userRoles.includes(required)
}
