import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
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

  const handleGoogleSignIn = async () => {
    setSubmitting(true)
    setMessage(null)
    setError(null)
    try {
      const result = await session.signInWithGoogle()
      if (result && !result.ok) {
        setError(result.error)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

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
          Magic Link / Google
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

      {authMethod === 'magic' && session.googleOAuthEnabled && (
        <>
          <div className="flex items-center justify-center gap-3 text-slate-400 text-xs my-1">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="font-semibold uppercase tracking-wider text-[10px]">or</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <button
            type="button"
            className="btn w-full flex items-center justify-center gap-2"
            disabled={submitting}
            onClick={handleGoogleSignIn}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </>
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
