import { Lock, LogIn, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import type { StaffRole } from './staff-roles'
import { StaffSignInForm } from './AuthProvider'
import { useStaffSession } from './useStaffSession'

type Props = {
  /** Required staff role for this workspace */
  role: StaffRole
  children: ReactNode
}

/**
 * Gates Admin / Teacher routes. Learners never pass through here.
 */
export function StaffGate({ role, children }: Props) {
  const session = useStaffSession()

  if (!session.ready) {
    return (
      <div className="access-page">
        <PageHeader icon={Lock} kicker="Staff" title="Checking sign-in…" subtitle="One moment." />
      </div>
    )
  }

  if (!session.signedIn) {
    return (
      <div className="access-page">
        <PageHeader
          icon={Lock}
          kicker="Staff only"
          title={role === 'admin' ? 'Admin sign-in required' : 'Teacher sign-in required'}
          subtitle="Use your Supabase Auth staff account. Learners open a signed learner access link instead."
        />
        <div className="panel" style={{ maxWidth: 460, margin: '0 auto' }}>
          {session.authEnabled ? (
            <>
              <StaffSignInForm />
              <p className="meta" style={{ marginTop: 12 }}>
                <LogIn className="h-4 w-4" aria-hidden /> Enter the magic link sent by Supabase Auth.
              </p>
            </>
          ) : (
            <p className="meta">
              Supabase Auth is not configured. Set <code>VITE_SUPABASE_URL</code> and{' '}
              <code>VITE_SUPABASE_ANON_KEY</code>, or enable <code>VITE_AUTH_BYPASS=true</code>{' '}
              for local demos.
            </p>
          )}
          <p className="meta" style={{ marginTop: 12 }}>
            Student?{' '}
            <Link to="/access" className="underline">
              Open learner portal
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (!session.canAccess(role)) {
    return (
      <div className="access-page">
        <PageHeader
          icon={ShieldAlert}
          kicker="No access"
          title="This workspace is not assigned to you"
          subtitle={
            session.email
              ? `Signed in as ${session.email}. Ask an admin to grant an active ${role} role in staff_roles.`
              : `Your account has no active ${role} role.`
          }
        />
        <div className="panel" style={{ maxWidth: 480, margin: '0 auto' }}>
          <p className="meta">
            Your staff roles: {session.staffRoles.length ? session.staffRoles.join(', ') : 'none'}
          </p>
          <p className="meta" style={{ marginTop: 8 }}>
            Staff authorization is database-owned in <code>staff_roles</code>; user-editable Auth
            metadata and email allowlists are not used for authorization.
          </p>
          <p className="meta" style={{ marginTop: 8 }}>
            Learners do not use Supabase Auth accounts — open the signed invite link at{' '}
            <code>/access?token=…</code>.
          </p>
          <div className="btn-row" style={{ marginTop: 12 }}>
            {session.canAccess('admin') ? (
              <Link to="/admin" className="btn ghost">
                Admin
              </Link>
            ) : null}
            {session.canAccess('teacher') ? (
              <Link to="/teacher" className="btn ghost">
                Teacher
              </Link>
            ) : null}
            <Link to="/" className="btn ghost">
              Home
            </Link>
            <Link to="/access" className="btn ghost">
              Learner portal
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
