import { useEffect, useMemo } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Plus,
  Radio,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  addSessionQuestion,
  markSessionCompleted,
} from '../../modules/assessment/session-capture'
import type { PolicyActor } from '../../modules/identity/access-policy'
import { getSupabase } from '../../lib/supabase'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { subscribeToClassSnapshots } from '../../modules/realtime/snapshot-channel'
import {
  completeLearningSession,
  recordAttendance,
} from '../../modules/scheduling/session-lifecycle'
import type { AttendanceStatus } from '../../modules/scheduling/types'
import { useAppState } from '../../state/useAppState'

const ATTENDANCE: AttendanceStatus[] = ['present', 'late', 'absent', 'excused']

export function TeacherSessionPage() {
  const {
    roster,
    scheduling,
    setScheduling,
    capture,
    setCapture,
    appendFinalizedFromCapture,
  } = useAppState()
  const { message, error, ok, err } = useFlash()

  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const activeLearners = useMemo(
    () =>
      classRow ? activeEnrollmentsForClass(roster, classRow.id).map((e) => e.learnerUserId) : [],
    [classRow, roster],
  )
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )

  const teacherActor = useMemo<PolicyActor | null>(
    () =>
      teacher
        ? {
            userId: teacher.id,
            organizationIds: [roster.organization.id],
            rolesByOrg: { [roster.organization.id]: ['teacher'] },
          }
        : null,
    [teacher, roster.organization.id],
  )

  useEffect(() => {
    if (!classRow || !teacherActor) return
    const sub = subscribeToClassSnapshots({
      client: getSupabase(),
      classId: classRow.id,
      actor: teacherActor,
      classScope: {
        organizationId: roster.organization.id,
        teacherUserId: classRow.teacherUserId,
        learnerUserIds: activeLearners,
      },
      onChange: () => {},
    })
    return () => sub.unsubscribe()
  }, [classRow, teacherActor, roster.organization.id, activeLearners])

  function applyCapture(next: NonNullable<typeof capture>) {
    setCapture(next)
    appendFinalizedFromCapture(next)
  }

  if (!classRow || !teacher) {
    return (
      <EmptyState
        icon={Radio}
        title="No class assigned"
        description="Assign a teacher to a class before running a live session."
      />
    )
  }

  if (!openSession || !capture || capture.sessionStatus !== 'open') {
    return (
      <>
        <PageHeader
          icon={Radio}
          kicker="Teacher"
          title="Live session"
          subtitle="Start a session from Schedule first."
        />
        <EmptyState
          icon={CalendarDays}
          title="No active learning session"
          description="Open Schedule to start an ad-hoc session or a planned slot."
          action={
            <Link to="/teacher/calendar" className="btn primary">
              <CalendarDays className="h-4 w-4" aria-hidden />
              <span>Open schedule</span>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={Radio}
        kicker="Live session"
        title="Classroom"
        subtitle={`Attendance and observation capture · ${openSession.id.slice(0, 10)}…`}
      />
      <Flash message={message} error={error} />

      <Panel
        icon={ClipboardCheck}
        title="1. Attendance"
        description="Mark each learner before or during the session."
        actions={
          <button
            type="button"
            className="primary"
            onClick={() => {
              const r = completeLearningSession(scheduling, openSession.id, activeLearners)
              if (!r.ok) return err(r.error)
              setScheduling(r.state)
              applyCapture(markSessionCompleted(capture))
              ok('Session completed')
            }}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            <span>Complete session</span>
          </button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Status</th>
                <th scope="col">Set</th>
              </tr>
            </thead>
            <tbody>
              {activeLearners.map((learnerId) => {
                const user = roster.users.find((u) => u.id === learnerId)
                const record = scheduling.attendance.find(
                  (a) =>
                    a.learningSessionId === openSession.id && a.learnerUserId === learnerId,
                )
                return (
                  <tr key={learnerId}>
                    <td className="font-medium text-slate-800">
                      <span className="cell-with-avatar">
                        <UserAvatar
                          name={user?.displayName ?? learnerId}
                          avatarUrl={user?.avatarUrl}
                          size="sm"
                        />
                        <span>{user?.displayName ?? learnerId}</span>
                      </span>
                    </td>
                    <td>
                      <span className="badge">{record?.status ?? '—'}</span>
                    </td>
                    <td>
                      <div className="btn-row my-0">
                        {ATTENDANCE.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={record?.status === status ? 'active' : 'ghost'}
                            onClick={() => {
                              const r = recordAttendance(scheduling, {
                                learningSessionId: openSession.id,
                                learnerUserId: learnerId,
                                status,
                              })
                              if (!r.ok) return err(r.error)
                              setScheduling(r.state)
                            }}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={Eye}
        title="2. Observe Focus / Awareness"
        description="Full-screen focus mode — large learner name, big color pads, keyboard shortcuts."
      >
        <div className="observe-entry">
          <p className="observe-entry-copy">
            Mark attendance above, then enter observation. The board hides menus so you can stay
            with the class.
          </p>
          <div className="btn-row">
            <Link to="/teacher/observe" className="btn primary observe-entry-cta">
              <Eye className="h-4 w-4" aria-hidden />
              <span>Enter observation</span>
            </Link>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const r = addSessionQuestion(capture)
                if (!r.ok) return err(r.error)
                setCapture(r.state)
                ok(`Question #${r.value.sequenceNumber} ready`)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>Prep next question</span>
            </button>
          </div>
          <p className="meta">
            Mode {capture.position.mode.replace('_', '-')} · Q{' '}
            {capture.position.questionIndex + 1}/{Math.max(capture.questions.length, 1)} ·{' '}
            {capture.attempts.filter(
              (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
            ).length}
            /{capture.attempts.length || '—'} finalized
          </p>
        </div>

        {capture.questions.length > 0 && (
          <div className="table-wrap mt-4">
            <table aria-label="Capture log" className="capture-matrix">
              <thead>
                <tr>
                  <th scope="col">Q#</th>
                  <th scope="col">Learner</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {capture.questions.map((q) => {
                  const a = capture.attempts.find((x) => x.sessionQuestionId === q.id)
                  const color =
                    a?.snapshot.effectiveColor ?? a?.snapshot.provisionalColor ?? null
                  const user = roster.users.find((u) => u.id === q.assignedLearnerUserId)
                  const name = user?.displayName ?? q.assignedLearnerUserId
                  return (
                    <tr key={q.id}>
                      <th scope="row" className="font-mono text-xs">
                        {q.sequenceNumber}
                      </th>
                      <td className="text-left font-medium text-slate-800">
                        <span className="cell-with-avatar">
                          <UserAvatar name={name} avatarUrl={user?.avatarUrl} size="sm" />
                          <span>{name}</span>
                        </span>
                      </td>
                      <td>
                        {color ? (
                          <span className={`capture-dot ${color}`}>{color}</span>
                        ) : (
                          <span className="capture-dot">·</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="meta mt-2">
              Rule: 1 sentence → 1 learner (round-robin). With {capture.questions.length} Q and{' '}
              {capture.learnerIds.length} learners, each gets ~
              {Math.floor(capture.questions.length / Math.max(capture.learnerIds.length, 1))}–
              {Math.ceil(capture.questions.length / Math.max(capture.learnerIds.length, 1))} results.
            </p>
          </div>
        )}
      </Panel>
    </>
  )
}
