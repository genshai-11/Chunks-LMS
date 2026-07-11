import type { AppRole } from '../types/database'

export type RoleRoute = {
  role: AppRole
  path: string
  label: string
}

export const ROLE_ROUTES: RoleRoute[] = [
  { role: 'admin', path: '/admin', label: 'Admin' },
  { role: 'teacher', path: '/teacher', label: 'Teacher' },
  { role: 'learner', path: '/learner', label: 'Learner' },
]

export function canAccessRole(userRoles: AppRole[], required: AppRole): boolean {
  return userRoles.includes(required)
}
