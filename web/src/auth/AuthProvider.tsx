import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, LogOut, UserRound } from 'lucide-react'
import { useStaffSession } from './useStaffSession'

type Props = { children?: ReactNode }

export function AuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function StaffSignInForm() {
  const session = useStaffSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMethod, setAuthMethod] = useState<'magic' | 'password'>('magic')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-2">
        <button
          type="button"
          onClick={() => {
            setAuthMethod('magic')
            setError(null)
            setMessage(null)
          }}
          className={`flex-1 pb-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${
            authMethod === 'magic'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Magic Link
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod('password')
            setError(null)
            setMessage(null)
          }}
          className={`flex-1 pb-2.5 text-sm font-semibold text-center border-b-2 transition-colors ${
            authMethod === 'password'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Password
        </button>
      </div>

      {authMethod === 'magic' ? (
        <form
          className="flex flex-col gap-4"
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
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
            <span>Staff email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              required
              autoComplete="email"
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-3xs outline-none focus:border-red-500"
            />
          </label>
          <button
            type="submit"
            className="btn primary w-full flex items-center justify-center gap-2"
            disabled={submitting}
          >
            <LogIn className="h-4 w-4" aria-hidden />
            <span>{submitting ? 'Sending magic link…' : 'Sign in with Magic Link'}</span>
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              setSubmitting(true)
              setMessage(null)
              setError(null)

              const action = isSignUp
                ? session.signUpWithPassword(email, password)
                : session.signInWithPassword(email, password)

              void action
                .then((result) => {
                  if (result.ok) {
                    setMessage(
                      isSignUp
                        ? (result as any).message || 'Account created successfully!'
                        : 'Signed in successfully!',
                    )
                  } else {
                    setError(result.error)
                  }
                })
                .finally(() => setSubmitting(false))
            }}
          >
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
              <span>Staff email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                required
                autoComplete="email"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-3xs outline-none focus:border-red-500"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-3xs outline-none focus:border-red-500"
              />
            </label>
            <button
              type="submit"
              className="btn primary w-full flex items-center justify-center gap-2"
              disabled={submitting}
            >
              <LogIn className="h-4 w-4" aria-hidden />
              <span>
                {submitting
                  ? 'Please wait…'
                  : isSignUp
                    ? 'Create Account'
                    : 'Sign in with Password'}
              </span>
            </button>
          </form>

          <div className="text-center text-xs">
            <button
              type="button"
              className="text-red-600 hover:text-red-500 font-semibold underline transition-colors"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setMessage(null)
              }}
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      )}

      {message ? <p className="banner ok text-center mt-2">{message}</p> : null}
      {error ? <p className="banner err text-center mt-2">{error}</p> : null}
    </div>
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
        <details className="auth-account-menu">
          <summary title={session.email ?? 'Account'}>
            <UserRound className="h-4 w-4" aria-hidden />
            <span>Account</span>
          </summary>
          <div className="auth-account-popover">
            <strong>{session.email}</strong>
            {session.staffRoles.length > 0 ? (
              <span className="meta auth-role-pill" title="Database staff roles">
                {session.staffRoles.join(' · ')}
              </span>
            ) : null}
            <button type="button" className="ghost" onClick={() => void session.signOut()}>
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
            {children}
          </div>
        </details>
      ) : (
        <>
          <Link
            to="/admin"
            className="btn ghost"
            style={{
              minHeight: '2rem',
              height: '2rem',
              padding: '0 0.75rem',
              fontSize: '0.75rem',
              borderRadius: '8px',
            }}
          >
            Staff Sign In
          </Link>
          {children}
        </>
      )}
    </div>
  )
}
