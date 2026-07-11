import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ProgressAnalysisView } from '../../components/ProgressAnalysisView'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function TeacherAnalysisPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const course = roster.courses.find((c) => c.id === classRow?.courseId) ?? roster.courses[0]
  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id)
        .map((e) => roster.users.find((u) => u.id === e.learnerUserId))
        .filter(Boolean)
    : roster.users.filter((u) => u.roles.includes('learner'))

  if (!course || !classRow) {
    return (
      <>
        <PageHeader kicker="Teacher" title="Analysis & progress" />
        <div className="empty-state">Assign a class and course first (Admin).</div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Analysis"
        subtitle={`${course.code} · ${classRow.name}`}
        actions={
          <Link to="/teacher/session" className="btn ghost">
            Session
          </Link>
        }
      />
      <ProgressAnalysisView
        mode="teacher"
        courseId={course.id}
        courseCode={course.code}
        courseStart={course.startsOn ?? '2026-07-01'}
        courseEnd={course.endsOn}
        classId={classRow.id}
        className={classRow.name}
        ledger={ledger}
        users={[
          ...learners.filter((u): u is NonNullable<typeof u> => Boolean(u)),
          ...roster.users.filter((u) => u.roles.includes('teacher')),
        ]}
        learningSessions={scheduling.learningSessions
          .filter((s) => s.classId === classRow.id)
          .map((s) => ({
            id: s.id,
            startedAt: s.startedAt,
            completedAt: s.completedAt,
          }))}
        emptyHint="Start a live session and finalize Focus / Awareness colors to populate this report."
        metricSettings={metricSettings}
      />
    </>
  )
}
