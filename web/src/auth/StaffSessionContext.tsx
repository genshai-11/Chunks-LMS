import { useAuth, useUser } from '@clerk/react'
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { env } from '../env'
import { setSupabaseAccessToken, setSupabaseAccessTokenProvider } from '../lib/supabase'
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
    const staffRoles = resolveStaffRoles(
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

    return buildSession({
      ready,
      signedIn: Boolean(isSignedIn),
      authBypass: false,
      clerkEnabled: true,
      userId: isSignedIn ? (userId ?? null) : null,
      email,
      displayName: user?.fullName ?? user?.username ?? email,
      staffRoles,
    })
  }, [isLoaded, isSignedIn, userId, user, userLoaded])

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>
}

export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext)
  if (!ctx) {
    throw new Error('useStaffSession must be used within a StaffSession provider')
  }
  return ctx
}
