import { useMemo } from 'react'
import { BookMarked } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useAppState } from '../../state/useAppState'

export function LearnerEnrollmentsPage() {
  const { roster } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myEnrollments = useMemo(
    () => roster.enrollments.filter((e) => e.learnerUserId === learner?.id),
    [roster.enrollments, learner?.id],
  )

  return (
    <>
      <div className="learner-dash-head">
        {learner ? (
          <UserAvatar
            name={learner.displayName}
            avatarUrl={learner.avatarUrl}
            size="xl"
            className="learner-dash-avatar"
          />
        ) : null}
        <PageHeader
          icon={BookMarked}
          kicker="Learner"
          title={learner ? `Hi, ${learner.displayName.split(' ')[0]}` : 'My classes'}
          subtitle={
            learner
              ? `${learner.displayName} · classes you are enrolled in.`
              : 'Classes you are enrolled in.'
          }
        />
      </div>
      <Panel icon={BookMarked} title="Enrollments" description="Active and past memberships.">
        {myEnrollments.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No enrollments yet"
            description="Your class seats will appear here once admin enrolls you."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Ended</th>
                </tr>
              </thead>
              <tbody>
                {myEnrollments.map((e) => {
                  const cl = roster.classes.find((c) => c.id === e.classId)
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                          <BookMarked className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          {cl?.name ?? e.classId}
                        </span>
                      </td>
                      <td>
                        <span className={`badge${e.status === 'active' ? ' success' : ''}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{e.startedAt.slice(0, 10)}</td>
                      <td className="font-mono text-xs">{e.endedAt?.slice(0, 10) ?? '—'}</td>
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
