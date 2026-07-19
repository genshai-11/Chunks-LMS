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
    <div 
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.25rem', 
        width: '100%',
        padding: '2.25rem',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(26, 32, 44, 0.85) 0%, rgba(23, 25, 35, 0.95) 100%)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.5)'
      }}
    >
      <form
        className={compact ? 'auth-actions' : 'form-grid'}
        style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a0aec0', textTransform: 'uppercase', letterSpacing: '0.075em' }}>
            Staff email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
            required
            autoComplete="email"
            style={{ 
              width: '100%', 
              padding: '0.85rem 1.15rem', 
              borderRadius: '10px', 
              border: '1px solid rgba(255, 255, 255, 0.15)', 
              backgroundColor: 'rgba(10, 12, 18, 0.6)', 
              color: '#fff',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </label>
        <button 
          type="submit" 
          className="primary" 
          disabled={submitting}
          style={{ 
            width: '100%', 
            padding: '0.85rem', 
            borderRadius: '10px', 
            fontWeight: 700, 
            fontSize: '0.95rem',
            backgroundColor: '#3182ce', 
            color: '#fff', 
            border: 'none', 
            cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(49, 130, 206, 0.4)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {submitting ? 'Sending…' : 'Staff sign in'}
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#718096', fontSize: '0.8rem' }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
        <span style={{ fontWeight: 600, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}></div>
      </div>

      <button
        type="button"
        className="ghost"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '0.75rem', 
          width: '100%', 
          padding: '0.85rem',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          color: '#e2e8f0',
          fontWeight: 700,
          fontSize: '0.95rem',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        disabled={submitting}
        onClick={handleGoogleSignIn}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>

      {message ? <span className="meta" style={{ color: '#48bb78', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem', display: 'block' }}>{message}</span> : null}
      {error ? <span className="meta err" style={{ color: '#f56565', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.5rem', display: 'block' }}>{error}</span> : null}
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
          <StaffSignInForm compact />
          {children}
        </>
      )}
    </div>
  )
}
