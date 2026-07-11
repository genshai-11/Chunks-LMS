import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { ProgressAnalysisView } from '../../components/ProgressAnalysisView'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function TeacherAnalysisPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const { classRow, course } = useTeacherClassContext()

  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id)
        .map((e) => roster.users.find((u) => u.id === e.learnerUserId))
        .filter(Boolean)
    : []

  if (!course || !classRow) {
    return (
      <>
        <PageHeader kicker="Teacher" title="Analysis & progress" />
        <div className="empty-state">Assign a class and course first (Admin). Use the class switcher when you teach more than one.</div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Analysis"
        subtitle={`${course.code} · ${classRow.name} · focus on RFC/RAC by day & learner`}
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
        totalDays={course.schedule?.sessionCount ?? null}
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
            sessionNumber: s.sessionNumber,
          }))}
        emptyHint="Start a live session and finalize Focus / Awareness colors to populate this report."
        metricSettings={metricSettings}
      />
    </>
  )
}
