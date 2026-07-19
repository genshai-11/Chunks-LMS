import { GraduationCap, LogIn, RotateCcw, Shield, Users } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useStaffSession } from '../auth/useStaffSession'
import { env } from '../env'
import { useAppState } from '../state/useAppState'

export function HomePage() {
  const { resetAll, ledger, roster } = useAppState()
  const session = useStaffSession()
  const className = roster.classes[0]?.name
  const courseCode = roster.courses[0]?.code
  const people = roster.users.length

  if (session.ready && session.signedIn && !session.authBypass) {
    return <Navigate to={session.canAccess('admin') ? '/admin' : '/teacher'} replace />
  }

  const chips = [
    {
      to: '/admin',
      title: 'Admin portal',
      description: 'Manage accounts, metrics, analysis & settings',
      icon: Shield,
    },
    {
      to: '/teacher',
      title: 'Teacher console',
      description: 'Start sessions, roster, observe & analyze',
      icon: Users,
    },
    {
      to: '/access',
      title: 'Learner portal',
      description: 'View attendance, progress & reports',
      icon: GraduationCap,
    },
  ]

  return (
    <div className="home-compact">
      <header className="home-compact-head">
        <img
          src="/logo.png"
          alt="Chunks"
          className="home-logo"
          width={220}
          height={66}
          decoding="async"
        />
        <h1 className="sr-only">Chunks LMS</h1>
        <p>Focus &amp; Awareness observation for small classes.</p>
        <div className="home-tools">
          {!session.signedIn && !session.authBypass ? (
            <Link to="/admin" className="btn primary">
              <LogIn className="h-4 w-4" aria-hidden />
              Staff Sign In
            </Link>
          ) : session.signedIn && !session.authBypass ? (
            <button
              type="button"
              className="ghost"
              onClick={() => void session.signOut()}
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          ) : null}
          {(session.authBypass || session.canAccess('admin')) && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (!window.confirm('Clear all local data (people, classes, sessions, results)?')) {
                  return
                }
                resetAll()
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Clear data
            </button>
          )}
        </div>
        <p className="meta home-meta">
          {env.isConfigured ? 'Connected' : 'Local'}
          {session.authBypass
            ? ' · staff bypass'
            : session.signedIn
              ? ' · staff signed in'
              : ' · staff sign-in for Admin/Teacher'}
          {people > 0 ? ` · ${people} people` : ' · empty org'}
          {courseCode ? ` · ${courseCode}` : ''}
          {className ? ` · ${className}` : ''}
          {ledger.length > 0 ? ` · ${ledger.length} results` : ''}
        </p>
      </header>

      <nav className="home-role-row" aria-label="Enter as">
        {chips.map((role) => {
          const Icon = role.icon
          return (
            <Link key={role.to} to={role.to} className="home-role-chip">
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <span>
                <strong>{role.title}</strong>
                <small>{role.description}</small>
              </span>
            </Link>
          )
        })}
      </nav>

      {!session.signedIn && !session.authBypass ? (
        <p className="meta" style={{ textAlign: 'center', marginTop: 16 }}>
          Admin and Teacher require a Supabase Auth staff account. Learners do not get staff Auth accounts — open the signed link sent by your teacher.
        </p>
      ) : null}
    </div>
  )
}
