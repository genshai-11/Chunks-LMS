import { useMemo, useState } from 'react'
import {
  BookMarked,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Link2,
  LogOut,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useActiveLearner } from '../../hooks/useActiveLearner'
import { formatScheduleLabel } from '../../modules/roster/schedule'
import {
  formatSessionClock,
  formatSessionDateIso,
  formatSessionTimeRange,
  isSameWallClockDay,
} from '../../modules/scheduling/session-time'
import type { ScheduledSession } from '../../modules/scheduling/types'
import { useAppState } from '../../state/useAppState'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

type CalView = 'week' | 'month'

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${weekStart.toLocaleDateString([], opts)} – ${end.toLocaleDateString([], {
    ...opts,
    year: 'numeric',
  })}`
}

function monthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

/** Mon-start grid covering the full month (leading/trailing days from adjacent months). */
function monthGridDays(monthStart: Date): Date[] {
  const first = startOfMonth(monthStart)
  const gridStart = startOfWeek(first)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const gridEnd = addDays(startOfWeek(last), 6)
  const days: Date[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  // Ensure complete weeks (42 cells max typical)
  while (days.length % 7 !== 0) {
    days.push(addDays(days[days.length - 1]!, 1))
  }
  return days
}

function sessionsOnDay(sessions: ScheduledSession[], day: Date): ScheduledSession[] {
  return sessions.filter((s) => isSameWallClockDay(s.plannedStart, day))
}

export function LearnerEnrollmentsPage() {
  const { roster, scheduling, setActiveLearnerUserId } = useAppState()
  const learner = useActiveLearner()
  const [view, setView] = useState<CalView>('week')
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))

  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const myEnrollments = useMemo(
    () =>
      learner
        ? roster.enrollments.filter((e) => e.learnerUserId === learner.id)
        : [],
    [roster.enrollments, learner],
  )

  const activeClassIds = useMemo(
    () =>
      new Set(
        myEnrollments.filter((e) => e.status === 'active').map((e) => e.classId),
      ),
    [myEnrollments],
  )

  const mySessions = useMemo(() => {
    return scheduling.scheduledSessions
      .filter(
        (s) =>
          activeClassIds.has(s.classId) &&
          s.status !== 'cancelled' &&
          s.status !== 'rescheduled',
      )
      .slice()
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
  }, [scheduling.scheduledSessions, activeClassIds])

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const monthDays = useMemo(() => monthGridDays(monthStart), [monthStart])

  const rangeLabel =
    view === 'week' ? weekRangeLabel(weekStart) : monthLabel(monthStart)

  function goPrev() {
    if (view === 'week') setAnchor((a) => addDays(startOfWeek(a), -7))
    else setAnchor((a) => addMonths(startOfMonth(a), -1))
  }

  function goNext() {
    if (view === 'week') setAnchor((a) => addDays(startOfWeek(a), 7))
    else setAnchor((a) => addMonths(startOfMonth(a), 1))
  }

  function goToday() {
    const t = new Date()
    setAnchor(view === 'week' ? startOfWeek(t) : startOfMonth(t))
  }

  function setViewMode(next: CalView) {
    setView(next)
    // Keep current context when switching week ↔ month
    setAnchor(next === 'week' ? startOfWeek(anchor) : startOfMonth(anchor))
  }

  function renderSessionChip(s: ScheduledSession, compact = false) {
    const cl = roster.classes.find((c) => c.id === s.classId)
    return (
      <div
        key={s.id}
        className={`learner-cal-chip is-${s.status}${compact ? ' is-compact' : ''}`}
        title={`${cl?.name ?? 'Class'} · ${formatSessionTimeRange(s.plannedStart, s.durationMinutes)}`}
      >
        <span className="learner-cal-chip-time">{formatSessionClock(s.plannedStart)}</span>
        {!compact ? (
          <span className="learner-cal-chip-meta">
            {s.sessionNumber != null ? `Day ${s.sessionNumber}` : cl?.name}
          </span>
        ) : s.sessionNumber != null ? (
          <span className="learner-cal-chip-meta">D{s.sessionNumber}</span>
        ) : null}
      </div>
    )
  }

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
        title="My calendar"
        description={rangeLabel}
        defaultOpen
        actions={
          <div className="learner-cal-toolbar">
            <div className="analysis-chip-row" role="group" aria-label="Calendar view">
              <button
                type="button"
                className={`analysis-chip${view === 'week' ? ' is-active' : ''}`}
                aria-pressed={view === 'week'}
                onClick={() => setViewMode('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`analysis-chip${view === 'month' ? ' is-active' : ''}`}
                aria-pressed={view === 'month'}
                onClick={() => setViewMode('month')}
              >
                Month
              </button>
            </div>
            <div className="sched-toolbar">
              <button type="button" className="ghost" aria-label="Previous" onClick={goPrev}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="ghost" onClick={goToday}>
                Today
              </button>
              <button type="button" className="ghost" aria-label="Next" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      >
        {mySessions.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No published meetings"
            description="When your teacher applies the course schedule, meetings appear here."
          />
        ) : view === 'week' ? (
          <div className="learner-week" role="grid" aria-label="Week calendar">
            {weekDays.map((day, i) => {
              const daySessions = sessionsOnDay(mySessions, day)
              const isToday = sameDay(day, today)
              return (
                <div
                  key={day.toISOString()}
                  role="gridcell"
                  className={`learner-week-day${isToday ? ' is-today' : ''}`}
                >
                  <header className="learner-week-day-head">
                    <span>{WEEKDAY_LABELS[i]}</span>
                    <strong>
                      {day.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </strong>
                  </header>
                  <div className="learner-week-day-body">
                    {daySessions.length === 0 ? (
                      <span className="learner-week-empty">—</span>
                    ) : (
                      daySessions.map((s) => renderSessionChip(s, false))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="learner-month" role="grid" aria-label="Month calendar">
            <div className="learner-month-head" aria-hidden>
              {WEEKDAY_LABELS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="learner-month-grid">
              {monthDays.map((day) => {
                const daySessions = sessionsOnDay(mySessions, day)
                const inMonth = day.getMonth() === monthStart.getMonth()
                const isToday = sameDay(day, today)
                return (
                  <div
                    key={day.toISOString()}
                    role="gridcell"
                    className={`learner-month-day${isToday ? ' is-today' : ''}${
                      inMonth ? '' : ' is-outside'
                    }`}
                  >
                    <span className="learner-month-date">{day.getDate()}</span>
                    <div className="learner-month-day-body">
                      {daySessions.slice(0, 3).map((s) => renderSessionChip(s, true))}
                      {daySessions.length > 3 ? (
                        <span className="learner-month-more">+{daySessions.length - 3}</span>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <p className="meta learner-tz-note">
          Times match course schedule (wall clock) · {mySessions.length} meeting
          {mySessions.length === 1 ? '' : 's'}
        </p>
      </Panel>

      <Panel icon={BookMarked} title="Enrollments" description="Your class memberships.">
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
                  <th scope="col">Course</th>
                  <th scope="col">Pattern</th>
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
                        {course?.code ?? '—'}
                        {course?.name ? ` · ${course.name}` : ''}
                      </td>
                      <td className="text-xs text-slate-600">
                        {course?.schedule ? formatScheduleLabel(course.schedule) : '—'}
                      </td>
                      <td>
                        <span className={`badge${e.status === 'active' ? ' success' : ''}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs">
                        {formatSessionDateIso(e.startedAt) !== '—'
                          ? e.startedAt.slice(0, 10)
                          : '—'}
                      </td>
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
