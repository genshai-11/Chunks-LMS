import { useEffect, useState } from 'react'
import { GraduationCap, LogIn, Mail } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { UserAvatar } from '../components/UserAvatar'
import { EmptyState, Panel } from '../components/ui'
import { findLearnerByEmail } from '../modules/roster/service'
import { useAppState } from '../state/useAppState'

/**
 * Learner portal entry: open invite link with ?email= or type email to view profile.
 * (Full Clerk magic-link auth can replace this later; V1 uses email match + local session.)
 */
export function LearnerAccessPage() {
  const { roster, setActiveLearnerUserId, activeLearnerUserId } = useAppState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = params.get('email')
    if (!fromQuery) return
    const learner = findLearnerByEmail(roster, fromQuery)
    if (learner) {
      setActiveLearnerUserId(learner.id)
      navigate('/learner/enrollments', { replace: true })
    }
  }, [params, roster, setActiveLearnerUserId, navigate])

  const current =
    activeLearnerUserId
      ? roster.users.find((u) => u.id === activeLearnerUserId)
      : null

  return (
    <div className="access-page">
      <PageHeader
        icon={GraduationCap}
        kicker="Learner"
        title="Open your portal"
        subtitle="Use the email your admin registered to view classes, learning days, and progress."
      />

      {current ? (
        <Panel icon={GraduationCap} title="Signed in as" description="Continue to your classes.">
          <div className="access-current">
            <UserAvatar name={current.displayName} avatarUrl={current.avatarUrl} size="lg" />
            <div>
              <strong>{current.displayName}</strong>
              <p className="meta">{current.email ?? 'No email on file'}</p>
            </div>
            <Link to="/learner/enrollments" className="btn primary">
              <LogIn className="h-4 w-4" aria-hidden />
              <span>Go to my classes</span>
            </Link>
            <button
              type="button"
              className="ghost"
              onClick={() => setActiveLearnerUserId(null)}
            >
              Switch learner
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel
        icon={Mail}
        title="Enter with email"
        description="Admin must add your email on the learner profile first."
      >
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            const learner = findLearnerByEmail(roster, email)
            if (!learner) {
              setError('No learner found with that email. Ask admin to add your email.')
              return
            }
            setActiveLearnerUserId(learner.id)
            navigate('/learner/enrollments')
          }}
        >
          <label className="form-span-full">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              required
              autoComplete="email"
            />
          </label>
          <button type="submit" className="primary">
            <LogIn className="h-4 w-4" aria-hidden />
            <span>View my profile</span>
          </button>
        </form>
        {error ? <p className="flash error mt-3">{error}</p> : null}
      </Panel>

      {roster.users.filter((u) => u.roles.includes('learner')).length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No learners yet"
          description="Admin creates learners under Classes → Students (with email), then shares the invite link."
          action={
            <Link to="/admin/classes" className="btn ghost">
              Admin · Classes
            </Link>
          }
        />
      ) : null}
    </div>
  )
}
