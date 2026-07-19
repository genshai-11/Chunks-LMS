import { useState, type ReactNode } from 'react'
import { useStaffSession } from './useStaffSession'

type Props = { children?: ReactNode }

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function StaffSignInForm({ compact = false }: { compact?: boolean }) {
  const session = useStaffSession()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <form
      className={compact ? 'auth-actions' : 'form-grid'}
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitting(true)
        setMessage(null)
        setError(null)
        void session
          .signInWithEmail(email)
          .then((result) => {
            if (result.ok) setMessage('Check your email for the Supabase Auth sign-in link.')
            else setError(result.error)
          })
          .finally(() => setSubmitting(false))
      }}
    >
      <label className={compact ? 'sr-only' : undefined}>
        Staff email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@example.com"
          required
          autoComplete="email"
        />
      </label>
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? 'Sending…' : 'Staff sign in'}
      </button>
      {message ? <span className="meta">{message}</span> : null}
      {error ? <span className="meta err">{error}</span> : null}
    </form>
  )
}

export { StaffSignInForm }

/** Sign-in / sign-out / role controls for the top bar (staff). */
export function AuthChrome({ children }: Props) {
  const session = useStaffSession()

  if (session.authBypass && !session.authEnabled) {
    return (
      <div className="auth-chrome">
        <span className="meta" title="VITE_AUTH_BYPASS — local/CI only">
          Staff bypass
        </span>
        {children}
      </div>
    )
  }

  return (
    <div className="auth-chrome">
      {session.signedIn ? (
        <div className="auth-actions">
          {session.staffRoles.length > 0 ? (
            <span className="meta auth-role-pill" title="Database staff roles">
              {session.staffRoles.join(' · ')}
            </span>
          ) : null}
          <span className="meta">{session.email}</span>
          <button type="button" className="ghost" onClick={() => void session.signOut()}>
            Sign out
          </button>
          {children}
        </div>
      ) : (
        <>
          <StaffSignInForm compact />
          {children}
        </>
      )}
    </div>
  )
}
