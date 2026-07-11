import { describe, expect, it } from 'vitest'
import { mapClerkUserToDomain, mergeUserUpsert } from './sync-user'

describe('Clerk user sync', () => {
  it('maps clerk payload to domain user', () => {
    const row = mapClerkUserToDomain({
      id: 'user_abc',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email_addresses: [{ email_address: 'ada@example.com' }],
    })
    expect(row).toEqual({
      clerk_user_id: 'user_abc',
      display_name: 'Ada Lovelace',
      email: 'ada@example.com',
    })
  })

  it('is idempotent across duplicate deliveries', () => {
    const incoming = mapClerkUserToDomain({
      id: 'user_abc',
      first_name: 'Ada',
      last_name: 'Lovelace',
      email_addresses: [{ email_address: 'ada@example.com' }],
    })
    const once = mergeUserUpsert(null, incoming)
    const twice = mergeUserUpsert(once, incoming)
    expect(twice).toEqual(once)
  })
})
