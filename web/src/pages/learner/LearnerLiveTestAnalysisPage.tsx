import { PageHeader } from '../../components/PageHeader'
import { LiveTestAnalysisView } from '../../components/LiveTestAnalysisView'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'
import { useAppState } from '../../state/useAppState'

export function LearnerLiveTestAnalysisPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const { learner, classRow, course } = useLearnerClassContext()

  if (!learner || !course) {
    return (
      <>
        <PageHeader kicker="Learner" title="Live Test Analysis" />
        <div className="empty-state">No enrollment or course yet.</div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Your Live Test results"
        subtitle={`${course.code}${classRow ? ` · ${classRow.name}` : ''} · standardized pre/post tests`}
      />
      <LiveTestAnalysisView
        mode="learner"
        courseId={course.id}
        courseCode={course.code}
        courseStart={classRow?.startsOn ?? '2026-07-01'}
        courseEnd={classRow?.endsOn ?? null}
        classId={classRow?.id}
        className={classRow?.name}
        totalDays={classRow?.schedule?.sessionCount ?? null}
        ledger={ledger}
        users={roster.users}
        learnerUserId={learner.id}
        learningSessions={scheduling.learningSessions
          .filter((s) => !classRow || s.classId === classRow.id)
          .map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
            sessionNumber: s.sessionNumber,
            sessionKind: s.sessionKind,
            sessionFormat: s.sessionFormat,
            promptLanguage: s.promptLanguage,
            liveTestResourceId: s.liveTestResourceId,
            liveTestBlockId: s.liveTestBlockId,
          }))}
        emptyHint="After your teacher finishes test sessions, results appear here."
        metricSettings={metricSettings}
      />
    </>
  )
}
