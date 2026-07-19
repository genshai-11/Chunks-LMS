import { describe, expect, it } from 'vitest'
import { mapSupabaseAuthUserToDomain, mergeUserUpsert } from './sync-user'

describe('Supabase Auth user sync', () => {
  it('maps Supabase Auth payload to staff domain user without Clerk authorization data', () => {
    const row = mapSupabaseAuthUserToDomain({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ada@example.com',
      user_metadata: { full_name: 'Ada Lovelace', chunksRole: 'admin' },
    })
    expect(row).toEqual({
      auth_user_id: '00000000-0000-4000-8000-000000000001',
      legacy_clerk_user_id: null,
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('is idempotent across duplicate deliveries and preserves legacy Clerk reference', () => {
    const existing = {
      auth_user_id: '00000000-0000-4000-8000-000000000001',
      legacy_clerk_user_id: 'user_legacy',
      display_name: 'Ada',
      email: 'old@example.com',
    }
    const incoming = mapSupabaseAuthUserToDomain({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ada@example.com',
      user_metadata: { full_name: 'Ada Lovelace' },
    })
    const once = mergeUserUpsert(existing, incoming)
    const twice = mergeUserUpsert(once, incoming)
    expect(twice).toEqual(once)
    expect(twice.legacy_clerk_user_id).toBe('user_legacy')
  })
})
