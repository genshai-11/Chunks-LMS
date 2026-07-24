import { useMemo } from 'react'
import { ListChecks } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useAppState } from '../../state/useAppState'

export function LearnerResultsPage() {
  const { roster, capture } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myResults = useMemo(() => {
    if (!capture || !learner) return []
    return capture.attempts.filter((a) => a.learnerUserId === learner.id)
  }, [capture, learner])

  return (
    <>
      <PageHeader
        icon={ListChecks}
        kicker="Learner"
        title="Results"
        subtitle="Observation outcomes from your current or last session."
      />
      <Panel
        icon={ListChecks}
        title="Session outcomes"
        description="Colors are teacher observations, not grades."
      >
        {myResults.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No assessment attempts yet"
            description="Results appear after a teacher records Focus / Awareness colors."
          />
        ) : (
          <div className="table-wrap">
            <table aria-label="My assessment results">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Status</th>
                  <th scope="col">Effective</th>
                </tr>
              </thead>
              <tbody>
                {myResults.map((a) => {
                  const q = capture?.questions.find((x) => x.id === a.sessionQuestionId)
                  return (
                    <tr key={a.id}>
                      <td className="font-mono text-xs font-bold">#{q?.sequenceNumber ?? '?'}</td>
                      <td>
                        <span className="badge">{a.snapshot.status}</span>
                      </td>
                      <td>
                        {a.snapshot.effectiveColor ? (
                          <span className={`capture-dot ${a.snapshot.effectiveColor}`}>
                            {a.snapshot.effectiveColor === 'yellow' ? 'orange' : a.snapshot.effectiveColor}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
