import { useEffect, useState } from 'react'
import { GraduationCap, LogIn, ShieldCheck } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { UserAvatar } from '../components/UserAvatar'
import { EmptyState, Panel } from '../components/ui'
import { loadLearnerAccessSnapshot } from '../modules/identity/learner-access'
import { useAppState } from '../state/useAppState'

/**
 * Learner portal entry (V2): signed, expiring, revocable `/access?token=` link.
 * Learners do not receive Supabase Auth accounts and cannot enter with email alone.
 */
export function LearnerAccessPage() {
  const {
    roster,
    setRoster,
    setScheduling,
    setLedger,
    setActiveLearnerUserId,
    setActiveLearnerClassId,
    activeLearnerUserId,
    backendStatus,
  } = useAppState()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const booting = backendStatus === 'booting'

  async function openWithToken(rawToken: string) {
    const trimmed = rawToken.trim()
    if (!trimmed) {
      setError('Paste the signed learner access token from your invite link.')
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    const result = await loadLearnerAccessSnapshot(trimmed)
    setLoading(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRoster(result.value.roster)
    setScheduling(result.value.scheduling)
    setLedger(result.value.ledger)
    setActiveLearnerUserId(result.value.grant.learnerUserId)
    setActiveLearnerClassId(result.value.grant.classId)
    setMessage(`Access verified for ${result.value.grant.learnerDisplayName}.`)
    navigate('/learner/enrollments', { replace: true })
  }

  useEffect(() => {
    const fromQuery = params.get('token')
    if (!fromQuery || booting) return
    setToken(fromQuery)
    void openWithToken(fromQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, booting])

  const current = activeLearnerUserId
    ? roster.users.find((u) => u.id === activeLearnerUserId && u.roles.includes('learner'))
    : null

  return (
    <div className="access-page">
      <PageHeader
        icon={GraduationCap}
        kicker="Learner"
        title="Open your portal"
        subtitle="Use the signed learner access link from your teacher. Learners do not sign in with Supabase Auth accounts."
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
              onClick={() => {
                setActiveLearnerUserId(null)
                setActiveLearnerClassId(null)
              }}
            >
              Use a different link
            </button>
          </div>
        </Panel>
      ) : null}

      <Panel
        icon={ShieldCheck}
        title="Enter with signed access"
        description="Signed learner links expire and can be revoked by staff. Email-only access is no longer accepted."
      >
        {booting ? (
          <p className="meta" role="status">
            Loading portal…
          </p>
        ) : null}
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            if (booting) {
              setError('Still loading portal — try again in a moment.')
              return
            }
            void openWithToken(token)
          }}
        >
          <label className="form-span-full">
            Signed access token
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="lat_…"
              required
              autoComplete="off"
            />
          </label>
          <button type="submit" className="primary" disabled={loading}>
            <LogIn className="h-4 w-4" aria-hidden />
            <span>{loading ? 'Verifying…' : 'Open my portal'}</span>
          </button>
        </form>
        {message ? <p className="banner ok mt-3" role="status">{message}</p> : null}
        {error ? <p className="banner err mt-3" role="alert">{error}</p> : null}
      </Panel>

      {roster.users.filter((u) => u.roles.includes('learner')).length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No learner portal is open"
          description="Ask your teacher to issue a fresh signed learner access link."
        />
      ) : null}
    </div>
  )
}
