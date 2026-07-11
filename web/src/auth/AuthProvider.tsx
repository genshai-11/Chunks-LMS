import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import type { ReactNode } from 'react'
import { env } from '../env'
import { useStaffSession } from './useStaffSession'

type Props = { children?: ReactNode }

/**
 * Layout wrapper for app content.
 * ClerkProvider lives in main.tsx when a publishable key is configured.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Sign-in / sign-up / user menu controls for the top bar (staff). */
export function AuthChrome({ children }: Props) {
  const session = useStaffSession()

  if (session.authBypass && !session.clerkEnabled) {
    return (
      <div className="auth-chrome">
        <span className="meta" title="VITE_AUTH_BYPASS — local/CI only">
          Staff bypass
        </span>
        {children}
      </div>
    )
  }

  if (!env.clerkPublishableKey) {
    return <div className="auth-chrome">{children}</div>
  }

  return (
    <div className="auth-chrome">
      <Show when="signed-out">
        <div className="auth-actions">
          <SignInButton mode="modal">
            <button type="button" className="ghost">
              Staff sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="primary">
              Staff sign up
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="auth-actions">
          {session.staffRoles.length > 0 ? (
            <span className="meta auth-role-pill" title="Staff roles">
              {session.staffRoles.join(' · ')}
            </span>
          ) : null}
          <UserButton />
          {children}
        </div>
      </Show>
    </div>
  )
}
