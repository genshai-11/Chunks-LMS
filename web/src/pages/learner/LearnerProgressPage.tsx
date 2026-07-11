import { useMemo } from 'react'
import { ChartColumn, ListOrdered } from 'lucide-react'
import { DynamicChartStudio } from '../../components/DynamicChartStudio'
import { PageHeader } from '../../components/PageHeader'
import { ProgressReportPanel } from '../../components/ProgressReportPanel'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { sessionLabel } from '../../modules/reporting/session-series'
import { useAppState } from '../../state/useAppState'

export function LearnerProgressPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myEnrollments = useMemo(
    () => roster.enrollments.filter((e) => e.learnerUserId === learner?.id),
    [roster.enrollments, learner?.id],
  )
  const classId = myEnrollments[0]?.classId
  const courseId = useMemo(() => {
    const enr = myEnrollments[0]
    if (!enr) return roster.courses[0]?.id
    const cl = roster.classes.find((c) => c.id === enr.classId)
    return cl?.courseId ?? roster.courses[0]?.id
  }, [myEnrollments, roster.classes, roster.courses])
  const course = roster.courses.find((c) => c.id === courseId)
  const classRow = roster.classes.find((c) => c.id === classId)

  const mySessions = useMemo(() => {
    if (!classId) return scheduling.learningSessions
    return scheduling.learningSessions
      .filter((s) => s.classId === classId)
      .slice()
      .sort((a, b) => (a.sessionNumber ?? 999) - (b.sessionNumber ?? 999))
  }, [scheduling.learningSessions, classId])

  const myResults = useMemo(
    () => (learner ? ledger.filter((r) => r.learnerUserId === learner.id) : []),
    [ledger, learner],
  )

  const sessionsWithData = useMemo(() => {
    const ids = new Set(myResults.map((r) => r.learningSessionId))
    return mySessions.filter((s) => ids.has(s.id))
  }, [mySessions, myResults])

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
        subtitle={`${course.code}${classRow ? ` · ${classRow.name}` : ''} · metrics per buổi.`}
      />

      <div className="stat-grid">
        <StatCard
          icon={ListOrdered}
          label="Buổi tracked"
          value={sessionsWithData.length}
          hint={
            course.schedule
              ? `of ${course.schedule.sessionCount} planned`
              : 'with finalized results'
          }
        />
        <StatCard
          icon={ChartColumn}
          label="Your results"
          value={myResults.length}
          hint="Finalized observations"
        />
      </div>

      <Panel
        title="Session list"
        description="Each buổi has an ID + number for tracking and report filters."
        defaultOpen
      >
        {mySessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            description="When your class runs live sessions, buổi 1, 2, … appear here."
          />
        ) : (
          <div className="session-track-list">
            {mySessions.map((s) => {
              const n = myResults.filter((r) => r.learningSessionId === s.id).length
              return (
                <div key={s.id} className="session-track-row">
                  <span className="session-track-num">
                    {sessionLabel(s.sessionNumber, s.startedAt)}
                  </span>
                  <span className="session-track-meta font-mono text-[11px] text-slate-500">
                    {new Date(s.startedAt).toLocaleString()} · {s.status}
                  </span>
                  <span className="badge">{n} results</span>
                  <span className="session-track-id font-mono text-[10px] text-slate-400">
                    {s.id.slice(0, 8)}…
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <DynamicChartStudio
        title="Compare buổi · dynamic charts"
        ledger={ledger}
        learningSessions={mySessions}
        courseId={course.id}
        classId={classId}
        learnerUserId={learner.id}
        metricSettings={metricSettings}
      />

      <ProgressReportPanel
        title="Window report"
        courseId={course.id}
        courseStart={course.startsOn ?? '2026-07-01'}
        courseEnd={course.endsOn}
        ledger={ledger}
        users={roster.users}
        learnerUserId={learner.id}
        learningSessions={mySessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          sessionNumber: s.sessionNumber,
        }))}
      />
    </>
  )
}
