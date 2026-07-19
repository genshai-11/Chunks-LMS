import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { LiveTestAnalysisView } from '../../components/LiveTestAnalysisView'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function TeacherLiveTestAnalysisPage() {
  const {
    roster,
    scheduling,
    ledger,
    metricSettings,
    activeLearnerUserId,
  } = useAppState()
  const { classRow, course } = useTeacherClassContext()

  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id)
        .map((e) => roster.users.find((u) => u.id === e.learnerUserId))
        .filter(Boolean)
    : []

  if (!course || !classRow) {
    return (
      <>
        <PageHeader kicker="Teacher" title="Live Test Analysis" />
        <div className="empty-state">
          Assign a class and course first (Admin).
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Live Test Analysis"
        subtitle={`${course.code} · ${classRow.name} · pre-test & post-test benchmark outcomes`}
        actions={
          <Link to="/teacher/session" className="btn ghost">
            Session
          </Link>
        }
      />
      <LiveTestAnalysisView
        mode="teacher"
        courseId={course.id}
        courseCode={course.code}
        courseStart={classRow.startsOn ?? '2026-07-01'}
        courseEnd={classRow.endsOn}
        classId={classRow.id}
        className={classRow.name}
        totalDays={classRow.schedule?.sessionCount ?? null}
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
            sessionKind: s.sessionKind,
            sessionFormat: s.sessionFormat,
            promptLanguage: s.promptLanguage,
            liveTestResourceId: s.liveTestResourceId,
            liveTestBlockId: s.liveTestBlockId,
          }))}
        emptyHint="Launch a Live Test session and finalize colors to populate standardized metrics."
        metricSettings={metricSettings}
        learnerUserId={activeLearnerUserId ?? undefined}
      />
    </>
  )
}
