import { GraduationCap, LogIn, RotateCcw, Shield, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { env } from '../env'
import { useAppState } from '../state/useAppState'

const ROLES = [
  { to: '/admin/courses', title: 'Admin', description: 'Courses, classes, people, metrics', icon: Shield },
  { to: '/teacher/session', title: 'Teacher', description: 'Schedule, live observe, analysis', icon: Users },
  {
    to: '/access',
    title: 'Learner',
    description: 'Email login · classes · learning days',
    icon: GraduationCap,
  },
] as const

export function HomePage() {
  const { resetAll, ledger, roster } = useAppState()
  const className = roster.classes[0]?.name
  const courseCode = roster.courses[0]?.code
  const people = roster.users.length

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
          <Link to="/access" className="btn ghost">
            <LogIn className="h-4 w-4" aria-hidden />
            Learner portal
          </Link>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (!window.confirm('Clear all local data (people, classes, sessions, results)?')) return
              resetAll()
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Clear data
          </button>
        </div>
        <p className="meta home-meta">
          {env.isConfigured ? 'Connected' : 'Local'}
          {people > 0 ? ` · ${people} people` : ' · empty org'}
          {courseCode ? ` · ${courseCode}` : ''}
          {className ? ` · ${className}` : ''}
          {ledger.length > 0 ? ` · ${ledger.length} results` : ''}
        </p>
      </header>

      <nav className="home-role-row" aria-label="Enter as">
        {ROLES.map((role) => {
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
    </div>
  )
}
