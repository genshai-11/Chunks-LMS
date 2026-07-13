import { useAuth, useUser } from '@clerk/react'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env } from '../env'
import { getSupabase, setSupabaseAccessToken, setSupabaseAccessTokenProvider } from '../lib/supabase'
import {
  canAccessStaffRole,
  resolveStaffRoles,
  rolesFromMetadata,
  type StaffRole,
} from './staff-roles'

export type StaffSession = {
  ready: boolean
  signedIn: boolean
  authBypass: boolean
  clerkEnabled: boolean
  userId: string | null
  email: string | null
  displayName: string | null
  staffRoles: StaffRole[]
  canAccess: (role: StaffRole) => boolean
  isStaff: boolean
}

const StaffSessionContext = createContext<StaffSession | null>(null)

function buildSession(partial: Omit<StaffSession, 'canAccess' | 'isStaff'>): StaffSession {
  return {
    ...partial,
    canAccess: (role) => canAccessStaffRole(partial.staffRoles, role),
    isStaff: partial.staffRoles.length > 0,
  }
}

function normalizeDbRole(role: unknown): StaffRole | null {
  return role === 'admin' || role === 'teacher' ? role : null
}

async function loadStaffRolesByEmail(email: string | null): Promise<StaffRole[]> {
  const normalized = email?.trim().toLowerCase()
  const sb = getSupabase()
  if (!normalized || !sb) return []

  const users = await sb.from('users').select('id,email').ilike('email', normalized)
  const userRows = (users.data ?? []) as unknown as Array<{ id: string; email: string | null }>
  if (users.error || userRows.length === 0) return []
  const userIds = userRows
    .filter((user) => String(user.email ?? '').toLowerCase() === normalized)
    .map((user) => user.id)
  if (userIds.length === 0) return []

  const memberships = await sb
    .from('organization_memberships')
    .select('role')
    .in('user_id', userIds)
  const membershipRows = (memberships.data ?? []) as unknown as Array<{ role: unknown }>
  if (memberships.error || membershipRows.length === 0) return []

  return Array.from(
    new Set(membershipRows.map((row) => normalizeDbRole(row.role)).filter(Boolean) as StaffRole[]),
  )
}

const BYPASS_SESSION = buildSession({
  ready: true,
  signedIn: true,
  authBypass: true,
  clerkEnabled: false,
  userId: 'bypass-staff',
  email: null,
  displayName: 'Local staff',
  staffRoles: ['admin', 'teacher'],
})

/** Local/CI: no Clerk required. */
export function BypassStaffSessionProvider({ children }: { children: ReactNode }) {
  return (
    <StaffSessionContext.Provider value={BYPASS_SESSION}>{children}</StaffSessionContext.Provider>
  )
}

/** Production path: Clerk session → staff roles (metadata / allowlist / bootstrap). */
export function ClerkStaffSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth()
  const { user, isLoaded: userLoaded } = useUser()
  const [dbRoles, setDbRoles] = useState<StaffRole[]>([])
  const [dbRoleEmail, setDbRoleEmail] = useState<string | null>(null)
  const [dbRolesLoading, setDbRolesLoading] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      setSupabaseAccessTokenProvider(null)
      void setSupabaseAccessToken(null)
      return
    }
    const provider = async () => getToken()
    setSupabaseAccessTokenProvider(provider)
    void provider().then((token) => setSupabaseAccessToken(token))
    return () => setSupabaseAccessTokenProvider(null)
  }, [isLoaded, isSignedIn, getToken])

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress ?? null
    const metadataRoles = rolesFromMetadata(
      user?.publicMetadata as Record<string, unknown> | undefined,
    )
    const configuredRoles = resolveStaffRoles(
      {
        userId: isSignedIn ? (userId ?? null) : null,
        email,
        metadataRoles,
      },
      {
        authBypass: false,
        adminEmails: env.staffAdminEmails,
        teacherEmails: env.staffTeacherEmails,
      },
    )

    if (!isLoaded || !userLoaded || !isSignedIn || !email || configuredRoles.length > 0) {
      setDbRoles([])
      setDbRoleEmail(null)
      setDbRolesLoading(false)
      return
    }

    let cancelled = false
    setDbRolesLoading(true)
    setDbRoleEmail(email)
    void loadStaffRolesByEmail(email)
      .then((roles) => {
        if (!cancelled) setDbRoles(roles)
      })
      .finally(() => {
        if (!cancelled) setDbRolesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isLoaded, isSignedIn, userId, user, userLoaded])

  const value = useMemo(() => {
    if (env.authBypass) {
      return buildSession({
        ready: true,
        signedIn: true,
        authBypass: true,
        clerkEnabled: true,
        userId: userId ?? 'bypass-staff',
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        displayName: user?.fullName ?? 'Local staff',
        staffRoles: ['admin', 'teacher'],
      })
    }

    const ready = isLoaded && userLoaded
    const email = user?.primaryEmailAddress?.emailAddress ?? null
    const metadataRoles = rolesFromMetadata(
      user?.publicMetadata as Record<string, unknown> | undefined,
    )
    const configuredRoles = resolveStaffRoles(
      {
        userId: isSignedIn ? (userId ?? null) : null,
        email,
        metadataRoles,
      },
      {
        authBypass: false,
        adminEmails: env.staffAdminEmails,
        teacherEmails: env.staffTeacherEmails,
      },
    )
    const staffRoles = configuredRoles.length > 0 ? configuredRoles : dbRoleEmail === email ? dbRoles : []

    return buildSession({
      ready: ready && !dbRolesLoading,
      signedIn: Boolean(isSignedIn),
      authBypass: false,
      clerkEnabled: true,
      userId: isSignedIn ? (userId ?? null) : null,
      email,
      displayName: user?.fullName ?? user?.username ?? email,
      staffRoles,
    })
  }, [dbRoleEmail, dbRoles, dbRolesLoading, isLoaded, isSignedIn, userId, user, userLoaded])

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
}

export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext)
  if (!ctx) {
    throw new Error('useStaffSession must be used within a StaffSession provider')
  }
  return ctx
}
