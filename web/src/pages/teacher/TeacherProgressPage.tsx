import { ChartColumn } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { ProgressReportPanel } from '../../components/ProgressReportPanel'
import { EmptyState } from '../../components/ui'
import { useAppState } from '../../state/useAppState'

export function TeacherProgressPage() {
  const { roster, scheduling, ledger } = useAppState()
  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const course = roster.courses.find((c) => c.id === classRow?.courseId) ?? roster.courses[0]

  if (!course) {
    return (
      <>
        <PageHeader icon={ChartColumn} kicker="Teacher" title="Reports" />
        <EmptyState
          icon={ChartColumn}
          title="No course available"
          description="Progress reporting needs an active course."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={ChartColumn}
        kicker="Teacher"
        title="Reports"
        subtitle={`${course.code} · operational metrics (not psychometric scores).`}
      />
      <ProgressReportPanel
        title="Course progress"
        courseId={course.id}
        courseStart={course.startsOn ?? '2026-07-01'}
        courseEnd={course.endsOn}
        ledger={ledger}
        users={roster.users}
        learningSessions={scheduling.learningSessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        }))}
      />
    </>
  )
}
