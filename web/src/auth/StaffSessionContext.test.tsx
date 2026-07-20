import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffSession } from './StaffSessionContext'
import { SupabaseStaffSessionProvider, useStaffSession } from './StaffSessionContext'

const mocks = vi.hoisted(() => ({ getSupabase: vi.fn() }))
vi.mock('../lib/supabase', () => ({ getSupabase: mocks.getSupabase }))

let latest: StaffSession | undefined
function CaptureSession() {
  latest = useStaffSession()
  return null
}

function fakeClient(options?: {
  user?: { id: string; email: string; user_metadata: Record<string, unknown> } | null
  roles?: Array<{ role: 'admin' | 'teacher'; active: boolean }>
  signInError?: string
  signUpSession?: object | null
}) {
  const user =
    options && 'user' in options
      ? options.user
      : {
          id: 'auth-1',
          email: 'admin@example.com',
          user_metadata: { full_name: 'Admin User' },
        }
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({
        error: options?.signInError ? { message: options.signInError } : null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { session: options?.signUpSession ?? null },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'domain-1', account_status: 'active' },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({
              data: options?.roles ?? [{ role: 'admin', active: true }],
              error: null,
            }),
          }),
        }),
      }
    }),
  }
}

describe('Supabase staff session', () => {
  beforeEach(() => {
    latest = undefined
    mocks.getSupabase.mockReset()
  })

  it('restores the native user and database-owned active roles', async () => {
    mocks.getSupabase.mockReturnValue(fakeClient())
    render(
      <SupabaseStaffSessionProvider>
        <CaptureSession />
      </SupabaseStaffSessionProvider>,
    )
    await waitFor(() => expect(latest?.ready).toBe(true))
    expect(latest).toMatchObject({ signedIn: true, userId: 'auth-1', email: 'admin@example.com' })
    expect(latest?.staffRoles).toEqual(['admin', 'teacher'])
  })

  it('reports confirmation when signup returns no active session', async () => {
    mocks.getSupabase.mockReturnValue(fakeClient({ user: null }))
    render(
      <SupabaseStaffSessionProvider>
        <CaptureSession />
      </SupabaseStaffSessionProvider>,
    )
    await waitFor(() => expect(latest?.ready).toBe(true))
    let result: Awaited<ReturnType<StaffSession['signUpWithPassword']>> | undefined
    await act(async () => {
      result = await latest!.signUpWithPassword('new@example.com', 'long-password')
    })
    expect(result).toEqual({
      ok: true,
      message: 'Account created! Please check your email to confirm signup.',
    })
  })

  it('surfaces native password sign-in errors without granting access', async () => {
    mocks.getSupabase.mockReturnValue(
      fakeClient({ user: null, signInError: 'Invalid login credentials' }),
    )
    render(
      <SupabaseStaffSessionProvider>
        <CaptureSession />
      </SupabaseStaffSessionProvider>,
    )
    await waitFor(() => expect(latest?.ready).toBe(true))
    let result: Awaited<ReturnType<StaffSession['signInWithPassword']>> | undefined
    await act(async () => {
      result = await latest!.signInWithPassword('staff@example.com', 'bad-password')
    })
    expect(result).toEqual({ ok: false, error: 'Invalid login credentials' })
    expect(latest?.signedIn).toBe(false)
  })
})
