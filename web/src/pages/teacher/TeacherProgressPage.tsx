import { useMemo } from 'react'
import { ChartColumn, ListOrdered } from 'lucide-react'
import { DynamicChartStudio } from '../../components/DynamicChartStudio'
import { PageHeader } from '../../components/PageHeader'
import { ProgressReportPanel } from '../../components/ProgressReportPanel'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { sessionLabel } from '../../modules/reporting/session-series'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'

export function TeacherProgressPage() {
  const { roster, scheduling, ledger, metricSettings } = useAppState()
  const { classRow, course } = useTeacherClassContext()

  const classSessions = useMemo(() => {
    if (!classRow) return []
    return scheduling.learningSessions
      .filter((s) => s.classId === classRow.id)
      .slice()
      .sort((a, b) => (a.sessionNumber ?? 999) - (b.sessionNumber ?? 999))
  }, [scheduling.learningSessions, classRow])

  const planned = useMemo(() => {
    if (!classRow) return []
    return scheduling.scheduledSessions
      .filter((s) => s.classId === classRow.id && s.status !== 'cancelled')
      .slice()
      .sort((a, b) => (a.sessionNumber ?? 999) - (b.sessionNumber ?? 999))
  }, [scheduling.scheduledSessions, classRow])

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
        subtitle={`${course.code}${classRow ? ` · ${classRow.name}` : ''} · compare buổi on enabled metrics.`}
      />

      <div className="stat-grid">
        <StatCard
          icon={ListOrdered}
          label="Planned buổi"
          value={planned.length || classRow?.schedule?.sessionCount || 0}
          hint={classRow?.schedule ? `${classRow.schedule.sessionCount} in plan` : 'scheduled'}
        />
        <StatCard
          icon={ChartColumn}
          label="Run sessions"
          value={classSessions.length}
          hint="with learning session"
        />
      </div>

      <Panel title="Buổi tracker" description="ID + session number for each class meeting.">
        {planned.length === 0 && classSessions.length === 0 ? (
          <EmptyState
            title="No buổi yet"
            description="Apply course plan on Schedule, or start ad-hoc sessions."
          />
        ) : (
          <div className="session-track-list">
            {(planned.length > 0 ? planned : classSessions).map((s) => {
              const isSched = 'plannedStart' in s
              const num = s.sessionNumber
              const when = isSched
                ? (s as { plannedStart: string }).plannedStart
                : (s as { startedAt: string }).startedAt
              const status = s.status
              const id = s.id
              const results = ledger.filter((r) => {
                if (isSched) {
                  const ls = classSessions.find((x) => x.scheduledSessionId === id)
                  return ls ? r.learningSessionId === ls.id : false
                }
                return r.learningSessionId === id
              }).length
              return (
                <div key={id} className="session-track-row">
                  <span className="session-track-num">{sessionLabel(num, when)}</span>
                  <span className="session-track-meta font-mono text-[11px] text-slate-500">
                    {new Date(when).toLocaleString()} · {status}
                  </span>
                  <span className="badge">{results} results</span>
                  <span className="session-track-id font-mono text-[10px] text-slate-400">
                    {id.slice(0, 8)}…
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
        learningSessions={classSessions}
        courseId={course.id}
        classId={classRow?.id}
        metricSettings={metricSettings}
      />

      <ProgressReportPanel
        title="Course progress"
        courseId={course.id}
        courseStart={classRow?.startsOn ?? '2026-07-01'}
        courseEnd={classRow?.endsOn ?? null}
        ledger={ledger}
        users={roster.users}
        learningSessions={classSessions.map((s) => ({
          id: s.id,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          sessionNumber: s.sessionNumber,
        }))}
      />
    </>
  )
}
