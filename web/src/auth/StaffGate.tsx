import { SignInButton } from '@clerk/react'
import { Lock, LogIn, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { env } from '../env'
import { PageHeader } from '../components/PageHeader'
import type { StaffRole } from './staff-roles'
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
          subtitle="Use your Clerk staff account. Learners open a shared portal link instead."
        />
        <div className="panel" style={{ maxWidth: 420, margin: '0 auto' }}>
          {env.clerkPublishableKey ? (
            <SignInButton mode="modal">
              <button type="button" className="primary" style={{ width: '100%' }}>
                <LogIn className="h-4 w-4" aria-hidden />
                <span>Sign in with Clerk</span>
              </button>
            </SignInButton>
          ) : (
            <p className="meta">
              Clerk is not configured. Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> or enable{' '}
              <code>VITE_AUTH_BYPASS=true</code> for local demos.
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
              ? `Signed in as ${session.email}. Ask an admin to grant the ${role} role (Clerk metadata or staff email allowlist).`
              : `Your account has no ${role} role.`
          }
        />
        <div className="panel" style={{ maxWidth: 480, margin: '0 auto' }}>
          <p className="meta">
            Your staff roles: {session.staffRoles.length ? session.staffRoles.join(', ') : 'none'}
          </p>
          <p className="meta" style={{ marginTop: 8 }}>
            Grant access by either:
          </p>
          <ul className="meta" style={{ marginTop: 6, paddingLeft: 18 }}>
            <li>
              Add your Clerk primary email to <code>VITE_STAFF_ADMIN_EMAILS</code> /{' '}
              <code>VITE_STAFF_TEACHER_EMAILS</code> (Vercel env) and redeploy
            </li>
            <li>
              Or set Clerk user public metadata:{' '}
              <code>{`{ "chunksRole": "admin" }`}</code> (or <code>"teacher"</code> /{' '}
              <code>"staff"</code>)
            </li>
          </ul>
          <p className="meta" style={{ marginTop: 8 }}>
            Learners do not use Clerk — open the invite link at <code>/access?email=…</code>.
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
