import { useMemo } from 'react'
import { ClipboardCheck, Clock3 } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useActiveLearner } from '../../hooks/useActiveLearner'
import { useAppState } from '../../state/useAppState'

export function LearnerAttendancePage() {
  const { scheduling } = useAppState()
  const learner = useActiveLearner()
  const myAttendance = useMemo(
    () => scheduling.attendance.filter((a) => a.learnerUserId === learner?.id),
    [scheduling.attendance, learner?.id],
  )

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        kicker="Learner"
        title="Attendance"
        subtitle="How you participated in sessions."
      />
      <Panel
        icon={ClipboardCheck}
        title="Records"
        description="Present, late, absent, or excused."
      >
        {myAttendance.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No attendance recorded yet"
            description="Records appear after a teacher marks you in a live session."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Session</th>
                  <th scope="col">Status</th>
                  <th scope="col">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {myAttendance.map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs">{a.learningSessionId.slice(0, 14)}…</td>
                    <td>
                      <span className="badge">{a.status}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600">
                        <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                        {new Date(a.recordedAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
