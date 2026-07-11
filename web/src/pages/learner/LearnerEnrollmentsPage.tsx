import { useMemo } from 'react'
import { BookMarked, CalendarDays, Clock3, Link2, LogOut } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useActiveLearner } from '../../hooks/useActiveLearner'
import { formatScheduleLabel } from '../../modules/roster/schedule'
import { useAppState } from '../../state/useAppState'

export function LearnerEnrollmentsPage() {
  const { roster, scheduling, setActiveLearnerUserId } = useAppState()
  const learner = useActiveLearner()

  const myEnrollments = useMemo(
    () =>
      learner
        ? roster.enrollments.filter((e) => e.learnerUserId === learner.id)
        : [],
    [roster.enrollments, learner],
  )

  const learningDays = useMemo(() => {
    if (!learner) return []
    return myEnrollments
      .filter((e) => e.status === 'active')
      .map((e) => {
        const cl = roster.classes.find((c) => c.id === e.classId)
        const course = roster.courses.find((c) => c.id === cl?.courseId)
        const upcoming = scheduling.scheduledSessions
          .filter(
            (s) =>
              s.classId === e.classId &&
              s.status === 'scheduled' &&
              s.plannedStart >= new Date().toISOString().slice(0, 10),
          )
          .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
          .slice(0, 8)
        return { enrollment: e, class: cl, course, upcoming }
      })
  }, [learner, myEnrollments, roster.classes, roster.courses, scheduling.scheduledSessions])

  if (!learner) {
    return (
      <>
        <PageHeader icon={BookMarked} kicker="Learner" title="No profile" />
        <EmptyState
          icon={BookMarked}
          title="Open your portal"
          description="Enter the email your admin registered, or open the invite link they sent you."
          action={
            <Link to="/access" className="btn primary">
              Enter with email
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <div className="learner-dash-head">
        <UserAvatar
          name={learner.displayName}
          avatarUrl={learner.avatarUrl}
          size="xl"
          className="learner-dash-avatar"
        />
        <PageHeader
          icon={BookMarked}
          kicker="Learner"
          title={`Hi, ${learner.displayName.split(' ')[0]}`}
          subtitle={
            learner.email
              ? `${learner.displayName} · ${learner.email}`
              : `${learner.displayName} · ask admin to add your email for invite links`
          }
          actions={
            <button
              type="button"
              className="ghost"
              onClick={() => setActiveLearnerUserId(null)}
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              <span>Switch</span>
            </button>
          }
        />
      </div>

      <Panel
        icon={CalendarDays}
        title="My learning days"
        description="Weekly pattern from your course schedule, plus upcoming meetings."
      >
        {learningDays.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No active classes"
            description="When you are seated in a class, meeting days appear here."
          />
        ) : (
          <div className="learner-days-list">
            {learningDays.map(({ enrollment, class: cl, course, upcoming }) => (
              <article key={enrollment.id} className="learner-day-card">
                <header className="learner-day-card-head">
                  <div>
                    <h3>{cl?.name ?? 'Class'}</h3>
                    <p className="meta">
                      {course?.code ?? 'Course'}
                      {course?.name ? ` · ${course.name}` : ''}
                    </p>
                  </div>
                  <span className={`badge${enrollment.status === 'active' ? ' success' : ''}`}>
                    {enrollment.status}
                  </span>
                </header>
                <p className="learner-day-pattern">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden />
                  <span>
                    {course?.schedule
                      ? formatScheduleLabel(course.schedule)
                      : 'No auto-schedule on course'}
                  </span>
                </p>
                {course?.startsOn || course?.endsOn ? (
                  <p className="meta">
                    Window {course.startsOn ?? '—'} → {course.endsOn ?? '—'}
                  </p>
                ) : null}
                {upcoming.length > 0 ? (
                  <ul className="learner-upcoming">
                    {upcoming.map((s) => (
                      <li key={s.id}>
                        <span className="font-mono">
                          {s.plannedStart.slice(0, 10)} · {s.plannedStart.slice(11, 16)}
                        </span>
                        <span className="meta">{s.durationMinutes} min</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="meta">
                    No published calendar yet — teacher can apply the course schedule.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel icon={BookMarked} title="Enrollments" description="Active and past memberships.">
        {myEnrollments.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="No enrollments yet"
            description="Your class seats will appear here once admin enrolls you."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Learning days</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Ended</th>
                </tr>
              </thead>
              <tbody>
                {myEnrollments.map((e) => {
                  const cl = roster.classes.find((c) => c.id === e.classId)
                  const course = roster.courses.find((c) => c.id === cl?.courseId)
                  return (
                    <tr key={e.id}>
                      <td>
                        <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                          <BookMarked className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                          {cl?.name ?? e.classId}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600">
                        {course?.schedule ? formatScheduleLabel(course.schedule) : '—'}
                      </td>
                      <td>
                        <span className={`badge${e.status === 'active' ? ' success' : ''}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{e.startedAt.slice(0, 10)}</td>
                      <td className="font-mono text-xs">{e.endedAt?.slice(0, 10) ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="meta access-help">
        <Link2 className="inline h-3 w-3" aria-hidden /> Bookmark{' '}
        <Link to="/access">/access</Link> or your invite link to return later.
      </p>
    </>
  )
}
