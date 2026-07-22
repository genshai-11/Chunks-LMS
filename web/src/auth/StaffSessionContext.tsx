import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import {
  canAccessStaffRole,
  normalizeStaffRole,
  resolveActiveStaffRoles,
  type StaffRole,
} from './staff-roles'

export type StaffSession = {
  ready: boolean
  signedIn: boolean
  authBypass: boolean
  authEnabled: boolean
  userId: string | null
  email: string | null
  displayName: string | null
  staffRoles: StaffRole[]
  canAccess: (role: StaffRole) => boolean
  isStaff: boolean
  signInWithEmail: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>
  signInWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; message: string } | { ok: false; error: string }>
  signOut: () => Promise<void>
}

const StaffSessionContext = createContext<StaffSession | null>(null)

function buildSession(
  partial: Omit<
    StaffSession,
    | 'canAccess'
    | 'isStaff'
    | 'signInWithEmail'
    | 'signInWithPassword'
    | 'signUpWithPassword'
    | 'signOut'
  > &
    Pick<StaffSession, 'signInWithEmail' | 'signInWithPassword' | 'signUpWithPassword' | 'signOut'>,
): StaffSession {
  return {
    ...partial,
    canAccess: (role) => canAccessStaffRole(partial.staffRoles, role),
    isStaff: partial.staffRoles.length > 0,
  }
}

const STAFF_LOGIN_ALIASES: Record<string, string> = {
  admin: 'admin@example.com',
  chunker: 'chunker@example.com',
}

function normalizeStaffLoginIdentifier(raw: string): string {
  const identifier = raw.trim().toLowerCase()
  return STAFF_LOGIN_ALIASES[identifier] ?? identifier
}

async function loadStaffRolesByAuthUserId(authUserId: string | null): Promise<StaffRole[]> {
  const sb = getSupabase()
  if (!authUserId || !sb) return []

  const userResult = await sb
    .from('users')
    .select('id,account_status')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  const userRow = userResult.data as { id: string; account_status?: string | null } | null
  if (userResult.error || !userRow || userRow.account_status === 'inactive') return []

  const rolesResult = await sb
    .from('staff_roles')
    .select('role,active')
    .eq('user_id', userRow.id)
    .eq('active', true)

  const roleRows = (rolesResult.data ?? []) as Array<{ role: unknown; active: unknown }>
  const grants = roleRows
    .map((row) => ({ role: normalizeStaffRole(row.role), active: Boolean(row.active) }))
    .filter((grant): grant is { role: StaffRole; active: boolean } => Boolean(grant.role))

  if (rolesResult.error) return []
  return resolveActiveStaffRoles(grants)
}

const noopSignIn: StaffSession['signInWithEmail'] = async () => ({
  ok: false,
  error: 'Supabase Auth is not configured',
})
const noopSignInPassword: StaffSession['signInWithPassword'] = async () => ({
  ok: false,
  error: 'Supabase Auth is not configured',
})
const noopSignUpPassword: StaffSession['signUpWithPassword'] = async () => ({
  ok: false,
  error: 'Supabase Auth is not configured',
})
const noopSignOut: StaffSession['signOut'] = async () => {}

const BYPASS_SESSION = buildSession({
  ready: true,
  signedIn: true,
  authBypass: true,
  authEnabled: false,
  userId: 'bypass-staff',
  email: null,
  displayName: 'Local staff',
  staffRoles: ['admin', 'teacher'],
  signInWithEmail: noopSignIn,
  signInWithPassword: noopSignInPassword,
  signUpWithPassword: noopSignUpPassword,
  signOut: noopSignOut,
})

/** Local/CI: no hosted Supabase Auth required. */
export function BypassStaffSessionProvider({ children }: { children: ReactNode }) {
  return (
    <StaffSessionContext.Provider value={BYPASS_SESSION}>{children}</StaffSessionContext.Provider>
  )
}

function displayNameFor(user: User | null): string | null {
  if (!user) return null
  const meta = user.user_metadata as Record<string, unknown> | null
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : null
  const name = typeof meta?.name === 'string' ? meta.name : null
  return fullName ?? name ?? user.email ?? user.id
}

/** Production path: native Supabase Auth session → database-owned staff_roles. */
export function SupabaseStaffSessionProvider({ children }: { children: ReactNode }) {
  const sb = getSupabase()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)

  const signInWithEmail = useCallback<StaffSession['signInWithEmail']>(
    async (email) => {
      if (!sb) return { ok: false, error: 'Supabase Auth is not configured' }
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined
      const { error } = await sb.auth.signInWithOtp({
        email: normalizeStaffLoginIdentifier(email),
        options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [sb],
  )

  const signInWithPassword = useCallback<StaffSession['signInWithPassword']>(
    async (email, password) => {
      if (!sb) return { ok: false, error: 'Supabase Auth is not configured' }
      const { error } = await sb.auth.signInWithPassword({
        email: normalizeStaffLoginIdentifier(email),
        password,
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },
    [sb],
  )

  const signUpWithPassword = useCallback<StaffSession['signUpWithPassword']>(
    async (email, password) => {
      if (!sb) return { ok: false, error: 'Supabase Auth is not configured' }
      const { data, error } = await sb.auth.signUp({
        email: normalizeStaffLoginIdentifier(email),
        password,
      })
      if (error) return { ok: false, error: error.message }
      if (data.session) {
        return { ok: true, message: 'Account created and signed in successfully!' }
      } else {
        return { ok: true, message: 'Account created! Please check your email to confirm signup.' }
      }
    },
    [sb],
  )

  const signOut = useCallback(async () => {
    if (sb) await sb.auth.signOut()
  }, [sb])

  useEffect(() => {
    if (!sb) {
      setReady(true)
      return
    }
    let cancelled = false
    void sb.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        const nextUser = data.user ?? null
        setRolesLoading(Boolean(nextUser))
        setUser(nextUser)
        setReady(true)
      }
    })
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setRolesLoading(Boolean(nextUser))
      setUser(nextUser)
      setReady(true)
    })
    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [sb])

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setStaffRoles([])
      setRolesLoading(false)
      return
    }
    setRolesLoading(true)
    void loadStaffRolesByAuthUserId(user.id)
      .then((roles) => {
        if (!cancelled) setStaffRoles(roles)
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const value = useMemo(
    () =>
      buildSession({
        ready: ready && !rolesLoading,
        signedIn: Boolean(user),
        authBypass: false,
        authEnabled: Boolean(sb),
        userId: user?.id ?? null,
        email: user?.email ?? null,
        displayName: displayNameFor(user),
        staffRoles,
        signInWithEmail,
        signInWithPassword,
        signUpWithPassword,
        signOut,
      }),
    [
      ready,
      rolesLoading,
      user,
      sb,
      staffRoles,
      signInWithEmail,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    ],
  )

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
}

export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext)
  if (!ctx) {
    throw new Error('useStaffSession must be used within a StaffSession provider')
  }
  return ctx
}
