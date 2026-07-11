import { useMemo } from 'react'
import { PageHeader } from '../../components/PageHeader'
import { ProgressAnalysisView } from '../../components/ProgressAnalysisView'
import { useAppState } from '../../state/useAppState'

export function LearnerAnalysisPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myEnrollments = useMemo(
    () =>
      roster.enrollments.filter(
        (e) => e.learnerUserId === learner?.id && e.status === 'active',
      ),
    [roster.enrollments, learner?.id],
  )
  const classRow = roster.classes.find((c) => c.id === myEnrollments[0]?.classId)
  const course = roster.courses.find((c) => c.id === classRow?.courseId) ?? roster.courses[0]

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
        title="Analysis"
        subtitle={`${course.code}${classRow ? ` · ${classRow.name}` : ''}`}
      />
      <ProgressAnalysisView
        mode="learner"
        courseId={course.id}
        courseCode={course.code}
        courseStart={course.startsOn ?? '2026-07-01'}
        courseEnd={course.endsOn}
        classId={classRow?.id}
        className={classRow?.name}
        ledger={ledger}
        users={roster.users}
        learnerUserId={learner.id}
        learningSessions={scheduling.learningSessions
          .filter((s) => !classRow || s.classId === classRow.id)
          .map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          }))}
        emptyHint="After your teacher finishes sessions, progress appears here."
        metricSettings={metricSettings}
      />
    </>
  )
}
