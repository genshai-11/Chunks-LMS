/**
 * Phase A staff roles — no organization membership product.
 * Admin/Teacher come from Clerk (or auth bypass). Learners use share links only.
 */

export type StaffRole = 'admin' | 'teacher'

export type StaffIdentity = {
  /** Clerk user id when signed in */
  userId: string | null
  email: string | null
  /**
   * Clerk publicMetadata.chunksRole ('admin' | 'teacher' | 'staff')
   * or publicMetadata.chunksRoles string[].
   */
  metadataRoles?: string[] | null
}

export type StaffRoleConfig = {
  /** When true, grant admin+teacher without Clerk (local/CI only). */
  authBypass: boolean
  /** Lowercased emails allowed as admin. Empty = not used for matching. */
  adminEmails: string[]
  /** Lowercased emails allowed as teacher. Empty = not used for matching. */
  teacherEmails: string[]
}

export function parseEmailList(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function normalizeMetadataRoles(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((r) => String(r).trim().toLowerCase()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [raw.trim().toLowerCase()]
  }
  return []
}

/**
 * Extract chunks roles from Clerk publicMetadata.
 * - chunksRoles: ['admin','teacher']
 * - chunksRole: 'admin' | 'teacher' | 'staff' (staff = both)
 */
export function rolesFromMetadata(publicMetadata: Record<string, unknown> | null | undefined): string[] {
  if (!publicMetadata) return []
  const list = normalizeMetadataRoles(publicMetadata.chunksRoles)
  if (list.length > 0) return list
  return normalizeMetadataRoles(publicMetadata.chunksRole)
}

function metadataGrants(meta: string[], role: StaffRole): boolean {
  if (meta.includes(role)) return true
  if (meta.includes('staff')) return true
  if (meta.includes('admin') && role === 'teacher') {
    // Admin may enter teacher workspace (ops / observe).
    return true
  }
  return false
}

/**
 * Resolve which staff workspaces the identity may open.
 * Priority: auth bypass → metadata → email allowlists → signed-in bootstrap.
 *
 * Bootstrap: if signed in, no metadata roles, and both allowlists empty,
 * grant admin+teacher so a fresh Clerk project can be used without config.
 * Production should set allowlists or Clerk publicMetadata.
 */
export function resolveStaffRoles(
  identity: StaffIdentity,
  config: StaffRoleConfig,
): StaffRole[] {
  if (config.authBypass) {
    return ['admin', 'teacher']
  }

  if (!identity.userId) {
    return []
  }

  const meta = (identity.metadataRoles ?? []).map((r) => r.toLowerCase())
  const email = identity.email?.trim().toLowerCase() ?? ''
  const hasAdminList = config.adminEmails.length > 0
  const hasTeacherList = config.teacherEmails.length > 0
  const roles = new Set<StaffRole>()

  if (meta.length > 0) {
    if (metadataGrants(meta, 'admin')) roles.add('admin')
    if (metadataGrants(meta, 'teacher')) roles.add('teacher')
    return [...roles]
  }

  if (hasAdminList || hasTeacherList) {
    if (email && hasAdminList && config.adminEmails.includes(email)) {
      roles.add('admin')
      roles.add('teacher') // admin can open teacher surfaces
    }
    if (email && hasTeacherList && config.teacherEmails.includes(email)) {
      roles.add('teacher')
    }
    return [...roles]
  }

  // Bootstrap: any signed-in Clerk user is staff
  return ['admin', 'teacher']
}

export function canAccessStaffRole(
  staffRoles: StaffRole[],
  required: StaffRole,
): boolean {
  if (required === 'teacher') {
    return staffRoles.includes('teacher') || staffRoles.includes('admin')
  }
  return staffRoles.includes(required)
}
