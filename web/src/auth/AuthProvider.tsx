import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import type { ReactNode } from 'react'
import { env } from '../env'

type Props = { children?: ReactNode }

/**
 * Layout wrapper for app content.
 * ClerkProvider lives in main.tsx when a publishable key is configured
 * and VITE_AUTH_BYPASS is not enabled (so CI/tests can still run without secrets).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

/** Sign-in / sign-up / user menu controls for the top bar. */
export function AuthChrome({ children }: Props) {
  if (!env.clerkPublishableKey || env.authBypass) {
    return (
      <div className="auth-chrome bypass">
        <span className="badge">Demo mode</span>
        {children}
      </div>
    )
  }

  return (
    <div className="auth-chrome">
      <Show when="signed-out">
        <div className="auth-actions">
          <SignInButton mode="modal">
            <button type="button" className="ghost">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button" className="primary">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="auth-actions">
          <UserButton />
          {children}
        </div>
      </Show>
    </div>
  )
}
