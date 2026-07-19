/**
 * Idempotent domain User upsert from native Supabase Auth user data.
 * Pure merge logic only; database authorization comes from staff_roles.
 */
export type SupabaseAuthUserPayload = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

export type DomainUserWrite = {
  auth_user_id: string
  legacy_clerk_user_id?: string | null
  display_name: string
  email: string | null
}

function displayNameFromMetadata(payload: SupabaseAuthUserPayload): string {
  const metadata = payload.user_metadata ?? {}
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : ''
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : ''
  return fullName || name || payload.email || payload.id
}

export function mapSupabaseAuthUserToDomain(payload: SupabaseAuthUserPayload): DomainUserWrite {
  return {
    auth_user_id: payload.id,
    legacy_clerk_user_id: null,
    display_name: displayNameFromMetadata(payload),
    email: payload.email ?? null,
  }
}

/**
 * Apply a provisioning event twice → same domain row (idempotent by auth_user_id).
 * Existing legacy Clerk references are preserved only for migration/rollback evidence.
 */
export function mergeUserUpsert(
  existing: DomainUserWrite | null,
  incoming: DomainUserWrite,
): DomainUserWrite {
  if (!existing) return incoming
  return {
    auth_user_id: existing.auth_user_id,
    legacy_clerk_user_id: existing.legacy_clerk_user_id ?? incoming.legacy_clerk_user_id ?? null,
    display_name: incoming.display_name || existing.display_name,
    email: incoming.email ?? existing.email,
  }
}
