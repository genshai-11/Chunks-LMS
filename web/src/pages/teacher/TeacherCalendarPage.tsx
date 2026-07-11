import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  Radio,
  Ban,
  Timer,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { createCaptureSession } from '../../modules/assessment/session-capture'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import {
  applyCourseScheduleToClass,
  cancelScheduledSession,
  createScheduledSession,
  startLearningSession,
} from '../../modules/scheduling/session-lifecycle'
import type { ScheduledSession } from '../../modules/scheduling/types'
import { useAppState } from '../../state/useAppState'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day // Monday start
  date.setDate(date.getDate() + diff)
  return date
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const y = weekStart.getFullYear() !== end.getFullYear()
  const left = weekStart.toLocaleDateString([], {
    ...opts,
    year: y ? 'numeric' : undefined,
  })
  const right = end.toLocaleDateString([], { ...opts, year: 'numeric' })
  return `${left} – ${right}`
}

function statusClass(status: ScheduledSession['status']): string {
  switch (status) {
    case 'scheduled':
      return 'sched-card is-scheduled'
    case 'completed':
      return 'sched-card is-completed'
    case 'cancelled':
      return 'sched-card is-cancelled'
    case 'rescheduled':
      return 'sched-card is-rescheduled'
    default:
      return 'sched-card'
  }
}

export function TeacherCalendarPage() {
  const { roster, scheduling, setScheduling, setCapture, metricSettings } = useAppState()
  const { message, error, ok, err } = useFlash()
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [duration, setDuration] = useState(60)
  const [slotHour, setSlotHour] = useState(9)

  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const course = roster.courses.find((c) => c.id === classRow?.courseId)
  const activeLearners = useMemo(
    () =>
      classRow ? activeEnrollmentsForClass(roster, classRow.id).map((e) => e.learnerUserId) : [],
    [classRow, roster],
  )
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const sessions = useMemo(
    () =>
      scheduling.scheduledSessions
        .filter((s) => s.classId === classRow?.id)
        .slice()
        .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
    [scheduling.scheduledSessions, classRow?.id],
  )

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  )

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ScheduledSession[]>()
    for (const day of weekDays) {
      map.set(day.toDateString(), [])
    }
    for (const s of sessions) {
      const d = new Date(s.plannedStart)
      const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString()
      const list = map.get(key)
      if (list) list.push(s)
    }
    return map
  }, [sessions, weekDays])

  const selectedSessions = useMemo(() => {
    const key = new Date(
      selectedDay.getFullYear(),
      selectedDay.getMonth(),
      selectedDay.getDate(),
    ).toDateString()
    return sessions
      .filter((s) => {
        const d = new Date(s.plannedStart)
        return (
          new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString() === key
        )
      })
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
  }, [sessions, selectedDay])

  const upcomingCount = sessions.filter((s) => s.status === 'scheduled').length

  if (!classRow || !teacher) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No class assigned"
        description="You need a class before scheduling sessions."
      />
    )
  }

  function startSession(scheduledSessionId?: string) {
    const maxProbe = metricSettings.defaultMaxProbeCount
    const r = startLearningSession(scheduling, {
      classId: classRow!.id,
      scheduledSessionId,
      maxProbeCount: maxProbe,
    })
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    setCapture(
      createCaptureSession({
        learningSessionId: r.value.id,
        teacherUserId: teacher!.id,
        learnerIds: activeLearners,
        maxProbeCount: maxProbe,
      }),
    )
    ok('Learning Session started — continue on Live session')
  }

  function scheduleAt(day: Date, hour: number, minutes = 0) {
    const start = new Date(day)
    start.setHours(hour, minutes, 0, 0)
    const r = createScheduledSession(scheduling, {
      classId: classRow!.id,
      plannedStart: start.toISOString(),
      durationMinutes: duration,
    })
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    setSelectedDay(day)
    ok(`Scheduled ${formatTime(r.value.plannedStart)} · ${duration}m`)
  }

  function goThisWeek() {
    const w = startOfWeek(new Date())
    setWeekAnchor(w)
    setSelectedDay(new Date())
  }

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        kicker={classRow.name}
        title="Schedule"
        subtitle="Week view · plan sessions and start class live."
        actions={
          <div className="page-actions">
            {course?.schedule && course.startsOn ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const r = applyCourseScheduleToClass(scheduling, {
                    classId: classRow.id,
                    course,
                  })
                  if (!r.ok) return err(r.error)
                  setScheduling(r.state)
                  ok(
                    r.value.length === 0
                      ? 'Schedule already applied (no new slots)'
                      : `Applied course schedule · ${r.value.length} sessions added`,
                  )
                  if (course.startsOn) {
                    const d = new Date(course.startsOn + 'T12:00:00')
                    setWeekAnchor(startOfWeek(d))
                    setSelectedDay(d)
                  }
                }}
              >
                <CalendarRange className="h-4 w-4" aria-hidden />
                <span>Apply course plan</span>
              </button>
            ) : null}
            {openSession ? (
              <Link to="/teacher/session" className="btn primary">
                <Radio className="h-4 w-4" aria-hidden />
                <span>Resume live</span>
              </Link>
            ) : (
              <button type="button" className="primary" onClick={() => startSession()}>
                <Play className="h-4 w-4" aria-hidden />
                <span>Start ad-hoc</span>
              </button>
            )}
          </div>
        }
      />
      <Flash message={message} error={error} />

      <div className="sched-stats">
        <div className="sched-stat">
          <span className="sched-stat-label">Upcoming</span>
          <strong className="sched-stat-value">{upcomingCount}</strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">This week</span>
          <strong className="sched-stat-value">
            {weekDays.reduce((n, d) => n + (sessionsByDay.get(d.toDateString())?.length ?? 0), 0)}
          </strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">Live</span>
          <strong className="sched-stat-value">{openSession ? 'Open' : '—'}</strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">Duration</span>
          <strong className="sched-stat-value font-mono">{duration}m</strong>
        </div>
      </div>

      <Panel
        icon={CalendarDays}
        title="Week calendar"
        description={weekRangeLabel(weekAnchor)}
        defaultOpen
        actions={
          <div className="sched-toolbar">
            <button
              type="button"
              className="ghost"
              aria-label="Previous week"
              onClick={() => setWeekAnchor((w) => addDays(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="ghost" onClick={goThisWeek}>
              Today
            </button>
            <button
              type="button"
              className="ghost"
              aria-label="Next week"
              onClick={() => setWeekAnchor((w) => addDays(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="sched-week" role="grid" aria-label="Week schedule">
          {weekDays.map((day, i) => {
            const daySessions = sessionsByDay.get(day.toDateString()) ?? []
            const isToday = sameDay(day, today)
            const isSelected = sameDay(day, selectedDay)
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                className={`sched-day${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <header className="sched-day-head">
                  <span className="sched-day-name">{WEEKDAY_LABELS[i]}</span>
                  <span className="sched-day-date">{formatDayHeader(day)}</span>
                </header>
                <div className="sched-day-body">
                  {daySessions.length === 0 ? (
                    <span className="sched-day-empty">—</span>
                  ) : (
                    daySessions.map((s) => (
                      <div key={s.id} className={statusClass(s.status)}>
                        <span className="sched-card-time">{formatTime(s.plannedStart)}</span>
                        <span className="sched-card-meta">{s.durationMinutes}m</span>
                      </div>
                    ))
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="sched-legend">
          <span>
            <i className="sched-dot is-scheduled" /> Scheduled
          </span>
          <span>
            <i className="sched-dot is-completed" /> Completed
          </span>
          <span>
            <i className="sched-dot is-cancelled" /> Cancelled
          </span>
          <span>
            <i className="sched-dot is-rescheduled" /> Rescheduled
          </span>
        </div>
      </Panel>

      <div className="sched-split">
        <Panel
          icon={Clock3}
          title={selectedDay.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
          description={`${selectedSessions.length} session${selectedSessions.length === 1 ? '' : 's'}`}
          defaultOpen
        >
          {selectedSessions.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No sessions this day"
              description="Use the quick add form to place a slot on this day."
            />
          ) : (
            <ul className="sched-agenda">
              {selectedSessions.map((s) => {
                const end = new Date(s.plannedStart)
                end.setMinutes(end.getMinutes() + s.durationMinutes)
                return (
                  <li key={s.id} className={`sched-agenda-item ${statusClass(s.status)}`}>
                    <div className="sched-agenda-time">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      <span>
                        {formatTime(s.plannedStart)} – {formatTime(end.toISOString())}
                      </span>
                    </div>
                    <div className="sched-agenda-body">
                      <strong>{classRow.name}</strong>
                      <span className="badge">{s.status}</span>
                      <span className="meta mt-0">
                        <Timer className="inline h-3 w-3" aria-hidden /> {s.durationMinutes} min
                      </span>
                    </div>
                    <div className="sched-agenda-actions">
                      {s.status === 'scheduled' && (
                        <>
                          <button
                            type="button"
                            className="primary"
                            disabled={Boolean(openSession)}
                            onClick={() => startSession(s.id)}
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden />
                            <span>Start</span>
                          </button>
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => {
                              const r = cancelScheduledSession(scheduling, s.id)
                              if (!r.ok) return err(r.error)
                              setScheduling(r.state)
                              ok('Session cancelled')
                            }}
                          >
                            <Ban className="h-3.5 w-3.5" aria-hidden />
                            <span>Cancel</span>
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          icon={CalendarPlus}
          title="Quick schedule"
          description="Add a slot on the selected day"
          defaultOpen
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              scheduleAt(selectedDay, slotHour, 0)
            }}
          >
            <label>
              Day
              <input
                type="date"
                value={`${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  if (!y || !m || !d) return
                  const next = new Date(y, m - 1, d)
                  setSelectedDay(next)
                  setWeekAnchor(startOfWeek(next))
                }}
              />
            </label>
            <label>
              Start hour
              <select
                value={slotHour}
                onChange={(e) => setSlotHour(Number(e.target.value))}
              >
                {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duration
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              <span>Add to day</span>
            </button>
          </form>

          <div className="sched-quick-slots">
            <p className="panel-title mb-2">Quick slots</p>
            <div className="btn-row my-0">
              {[9, 10, 14, 16].map((h) => (
                <button
                  key={h}
                  type="button"
                  className="ghost"
                  onClick={() => scheduleAt(selectedDay, h)}
                >
                  {String(h).padStart(2, '0')}:00
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const start = new Date()
                  start.setMinutes(0, 0, 0)
                  start.setHours(start.getHours() + 1)
                  scheduleAt(start, start.getHours(), start.getMinutes())
                }}
              >
                Next hour
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </>
  )
}
