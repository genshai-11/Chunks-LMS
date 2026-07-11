import { useMemo } from 'react'
import { BookOpen, ClipboardCheck } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'
import { useAppState } from '../../state/useAppState'

export function LearnerAttendancePage() {
  const { scheduling } = useAppState()
  const { learner, options, classRow } = useLearnerClassContext()

  const myAttendance = useMemo(() => {
    if (!learner) return []
    const rows = scheduling.attendance.filter((a) => a.learnerUserId === learner.id)
    if (!classRow) return rows
    const sessionIds = new Set(
      scheduling.learningSessions.filter((s) => s.classId === classRow.id).map((s) => s.id),
    )
    return rows.filter((a) => sessionIds.has(a.learningSessionId))
  }, [scheduling.attendance, scheduling.learningSessions, learner, classRow])

  const myClasses = useMemo(() => {
    return options.map((o) => {
      const upcoming = scheduling.scheduledSessions
        .filter((s) => s.classId === o.classRow.id && s.status === 'scheduled')
        .sort((a, b) => new Date(a.plannedStart).getTime() - new Date(b.plannedStart).getTime())
      return { klass: o.classRow, course: o.course, upcoming }
    })
  }, [options, scheduling.scheduledSessions])

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        kicker="Learner"
        title="Attendance & Schedule"
        subtitle="Manage your classes, weekly schedules, and track your attendance records."
      />

      <div className="learner-attendance-layout">
        {/* Left column: My Classes & Weekly Pattern */}
        <div className="learner-sidebar-panel">
          <Panel
            icon={BookOpen}
            title="My Classes"
            description="Your currently enrolled training courses."
          >
            {myClasses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Not enrolled in any classes"
                description="When you are added to a class, it will appear here."
              />
            ) : (
              <div className="flex flex-col gap-4">
                {myClasses.map(({ klass, course, upcoming }) => (
                  <div key={klass!.id} className="class-card">
                    <div className="class-card-header">
                      <h3 className="class-card-title">{course?.name ?? 'Course'}</h3>
                      <span className="class-card-subtitle">
                        {course?.code ?? 'CODE'} · {klass!.name}
                      </span>
                    </div>

                    <div className="upcoming-box">
                      <span className="upcoming-box-title">Upcoming Meetings</span>
                      {upcoming.length === 0 ? (
                        <p className="text-xs text-slate-500">No upcoming meetings scheduled.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {upcoming.slice(0, 3).map((session) => (
                            <div
                              key={session.id}
                              className="flex justify-between items-center text-xs py-1.5 border-b border-white/5 last:border-0"
                            >
                              <span className="font-semibold text-slate-300">
                                {session.sessionNumber ? `Session ${session.sessionNumber}` : 'Meeting'}
                              </span>
                              <span className="font-mono text-slate-400">
                                {new Date(session.plannedStart).toLocaleDateString()} at{' '}
                                {new Date(session.plannedStart).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Right column: Attendance Records Grid */}
        <div className="learner-main-panel">
          <Panel
            icon={ClipboardCheck}
            title="Attendance Grid"
            description="Present, late, absent, or excused."
          >
            {myAttendance.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No attendance recorded yet"
                description="Records appear after a teacher marks you in a live session."
              />
            ) : (
              <div className="attendance-grid">
                {myAttendance.map((a) => {
                  const session = scheduling.learningSessions.find((s) => s.id === a.learningSessionId)
                  const sessionNum = session?.sessionNumber ?? null
                  return (
                    <div key={a.id} className={`attendance-card status-${a.status}`}>
                      <div className="card-header">
                        <span className="session-tag">
                          {sessionNum ? `Day ${sessionNum}` : 'Session'}
                        </span>
                        <span className={`status-badge ${a.status}`}>
                          {a.status}
                        </span>
                      </div>
                      <div className="card-body">
                        <p className="card-date">
                          {session?.startedAt ? new Date(session.startedAt).toLocaleDateString() : '—'}
                        </p>
                        <p className="card-time">
                          Recorded {new Date(a.recordedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
