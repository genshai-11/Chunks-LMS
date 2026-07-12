import { PageHeader } from '../../components/PageHeader'
import { ProgressAnalysisView } from '../../components/ProgressAnalysisView'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'
import { useAppState } from '../../state/useAppState'

export function LearnerAnalysisPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const { learner, classRow, course } = useLearnerClassContext()

  if (!learner || !course) {
    return (
      <>
        <PageHeader kicker="Learner" title="Analysis & progress" />
        <div className="empty-state">No enrollment or course yet.</div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Your progress"
        subtitle={`${course.code}${classRow ? ` · ${classRow.name}` : ''} · how focus changes day by day`}
      />
      <ProgressAnalysisView
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
          }))}
        emptyHint="After your teacher finishes sessions, progress appears here."
        metricSettings={metricSettings}
      />
    </>
  )
}
