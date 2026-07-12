import { useEffect, useState } from 'react'
import { GraduationCap, LogIn, Mail } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { UserAvatar } from '../components/UserAvatar'
import { EmptyState, Panel } from '../components/ui'
import { findLearnerByEmail } from '../modules/roster/service'
import { useAppState } from '../state/useAppState'

/**
 * Learner portal entry (V1): share link `/access?email=` or type registered email.
 * No Clerk / no org membership for learners — staff copies invite from class roster.
 * Admin & Teacher use Clerk separately. Clerk learner accounts are deferred.
 */
export function LearnerAccessPage() {
  const { roster, setActiveLearnerUserId, activeLearnerUserId, backendStatus } = useAppState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [linkMiss, setLinkMiss] = useState(false)
  const booting = backendStatus === 'booting'

  useEffect(() => {
    const fromQuery = params.get('email')
    if (!fromQuery) {
      setLinkMiss(false)
      return
    }
    // Wait until workspace boot finishes so cloud roster is available.
    if (booting) return
    const learner = findLearnerByEmail(roster, fromQuery)
    if (learner) {
      setActiveLearnerUserId(learner.id)
      setLinkMiss(false)
      navigate('/learner/enrollments', { replace: true })
    } else {
      setEmail(fromQuery)
      setLinkMiss(true)
    }
  }, [params, roster, setActiveLearnerUserId, navigate, booting])

  const current =
    activeLearnerUserId
      ? roster.users.find(
          (u) => u.id === activeLearnerUserId && u.roles.includes('learner'),
        )
      : null

  return (
    <div className="access-page">
      <PageHeader
        icon={GraduationCap}
        kicker="Learner"
        title="Open your portal"
        subtitle="Use the invite link from your teacher, or type the exact email on your learner profile. Do not sign in with Clerk — that is for staff only."
      />

      {current ? (
        <Panel icon={GraduationCap} title="Portal open" description="Continue to your classes.">
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
              Use a different email
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel
        icon={Mail}
        title="Enter with email"
        description="Must match the email on your learner profile (from the invite link)."
      >
        {booting ? (
          <p className="meta" role="status">
            Loading class roster…
          </p>
        ) : null}
        {linkMiss && !booting ? (
          <p className="banner err" role="alert">
            No learner matches that invite email. Check the link or ask your teacher to re-send it
            (email must match the learner profile exactly).
          </p>
        ) : null}
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            setLinkMiss(false)
            if (booting) {
              setError('Still loading roster — try again in a moment.')
              return
            }
            const learner = findLearnerByEmail(roster, email)
            if (!learner) {
              setError(
                'No learner found with that email. Ask your teacher to share the invite link (must match the email on your profile).',
              )
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
            <span>Open my portal</span>
          </button>
        </form>
        {error ? <p className="banner err mt-3" role="alert">{error}</p> : null}
      </Panel>

      {roster.users.filter((u) => u.roles.includes('learner')).length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No learners yet"
          description="Staff creates learners under Classes → Students (with email), then shares the invite link."
        />
      ) : null}
    </div>
  )
}
