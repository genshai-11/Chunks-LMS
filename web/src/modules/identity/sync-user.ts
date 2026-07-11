/**
 * Idempotent domain User upsert from a Clerk user payload.
 * Intended for webhook handlers (Edge Function / server) — pure merge logic here.
 */
export type ClerkUserPayload = {
  id: string
  first_name?: string | null
  last_name?: string | null
  email_addresses?: Array<{ email_address: string }>
}

export type DomainUserWrite = {
  clerk_user_id: string
  display_name: string
  email: string | null
}

export function mapClerkUserToDomain(payload: ClerkUserPayload): DomainUserWrite {
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(' ').trim()
  return {
    clerk_user_id: payload.id,
    display_name: name || payload.email_addresses?.[0]?.email_address || payload.id,
    email: payload.email_addresses?.[0]?.email_address ?? null,
  }
}

/**
 * Apply a webhook delivery twice → same domain row (idempotent by clerk_user_id).
 */
export function mergeUserUpsert(
  existing: DomainUserWrite | null,
  incoming: DomainUserWrite,
): DomainUserWrite {
  if (!existing) return incoming
  return {
    clerk_user_id: existing.clerk_user_id,
    display_name: incoming.display_name || existing.display_name,
    email: incoming.email ?? existing.email,
  }
}
