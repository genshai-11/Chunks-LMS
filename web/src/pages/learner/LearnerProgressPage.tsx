import { useMemo } from 'react'
import { ChartColumn } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { ProgressReportPanel } from '../../components/ProgressReportPanel'
import { EmptyState } from '../../components/ui'
import { useAppState } from '../../state/useAppState'

export function LearnerProgressPage() {
  const { roster, scheduling, ledger } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myEnrollments = useMemo(
    () => roster.enrollments.filter((e) => e.learnerUserId === learner?.id),
    [roster.enrollments, learner?.id],
  )
  const courseId = useMemo(() => {
    const enr = myEnrollments[0]
    if (!enr) return roster.courses[0]?.id
    const cl = roster.classes.find((c) => c.id === enr.classId)
    return cl?.courseId ?? roster.courses[0]?.id
  }, [myEnrollments, roster.classes, roster.courses])
  const course = roster.courses.find((c) => c.id === courseId)

  if (!learner || !course) {
    return (
      <>
        <PageHeader icon={ChartColumn} kicker="Learner" title="Progress" />
        <EmptyState
          icon={ChartColumn}
          title="No course progress available"
          description="Enroll in a course to see operational indicators."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={ChartColumn}
        kicker="Learner"
        title="Progress"
        subtitle={`${course.code} · your metrics only.`}
      />
      <ProgressReportPanel
        title="My course progress"
        courseId={course.id}
        courseStart={course.startsOn ?? '2026-07-01'}
        courseEnd={course.endsOn}
        ledger={ledger}
        users={roster.users}
        learnerUserId={learner.id}
        learningSessions={scheduling.learningSessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        }))}
      />
    </>
  )
}
